require('dotenv').config();
const express = require('express');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const JSZip = require('jszip');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // NEW: The Wristband Maker
const cookieParser = require('cookie-parser'); // NEW: The Wristband Checker

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser()); // Turn on the cookie reader

// --- THE CLOUD VAULT CONNECTION ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Cloud Vault!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const linkSchema = new mongoose.Schema({
    shortId: { type: String, required: true, unique: true },
    targetUrl: { type: String, required: true },
    clicks: { type: Number, default: 0 }
});
const Link = mongoose.model('Link', linkSchema);

// --- THE BOUNCER (Authentication Middleware) ---
function requireAuth(req, res, next) {
    const token = req.cookies.tessr_auth; // Check for the VIP wristband
    if (!token) {
        return res.redirect('/login'); // No wristband? Go to the login line.
    }
    try {
        jwt.verify(token, process.env.JWT_SECRET); // Is the wristband fake?
        next(); // Wristband is valid! Let them in.
    } catch (err) {
        res.clearCookie('tessr_auth');
        return res.redirect('/login');
    }
}

// --- NEW: THE LOGIN SCREEN ---
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>TESSR | Admin Login</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 100px; background-color: #f4f4f9; color: #333; }
                .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); display: inline-block; width: 100%; max-width: 350px; box-sizing: border-box; }
                input { width: 100%; padding: 12px; margin-top: 10px; margin-bottom: 20px; border-radius: 6px; border: 1px solid #ddd; box-sizing: border-box; font-size: 14px; }
                button { width: 100%; background-color: #3730a3; color: #fff; border: none; padding: 12px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s; }
                button:hover { background-color: #312e81; }
                .error { color: red; font-size: 12px; display: none; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2 style="margin-top: 0;">TESSR Secure Area</h2>
                <p style="color: #666; font-size: 14px;">Please log in to continue.</p>
                <div id="errorMsg" class="error">Invalid username or password.</div>
                <input type="text" id="username" placeholder="Username">
                <input type="password" id="password" placeholder="Password">
                <button onclick="attemptLogin()">Log In</button>
                <a href="/" style="display: block; margin-top: 20px; color: #888; text-decoration: none; font-size: 12px;">&larr; Back to Generator</a>
            </div>
            <script>
                async function attemptLogin() {
                    const u = document.getElementById('username').value;
                    const p = document.getElementById('password').value;
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: u, password: p })
                    });
                    if (response.ok) {
                        window.location.href = '/admin'; // Success! Go to dashboard.
                    } else {
                        document.getElementById('errorMsg').style.display = 'block';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Check if what they typed matches your hidden .env file
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        // Create the VIP wristband (good for 24 hours)
        const token = jwt.sign({ user: username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // Slap the wristband on their browser
        res.cookie('tessr_auth', token, { httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('tessr_auth'); // Cut off the wristband
    res.json({ success: true });
});

// --- THE TRAFFIC COP (Dynamic Redirect Route) ---
// Notice: We do NOT put the bouncer here, because the public needs to scan the links!
app.get('/r/:id', async (req, res) => {
    try {
        const linkData = await Link.findOne({ shortId: req.params.id });
        if (linkData) {
            linkData.clicks++;
            await linkData.save();
            res.redirect(linkData.targetUrl); 
        } else {
            res.send("<h1>404</h1><p>This TESSR link is invalid or has expired.</p>");
        }
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

// --- THE ADMIN DASHBOARD (LOCKED DOWN) ---
// Notice the "requireAuth" right after the URL. The bouncer is standing right here.
app.get('/admin', requireAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>TESSR | Admin Dashboard</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 40px; background-color: #f4f4f9; color: #333; }
                .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); display: inline-block; text-align: left; width: 100%; max-width: 800px; box-sizing: border-box; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { padding: 15px; border-bottom: 1px solid #ddd; text-align: left; }
                th { background-color: #f8f9fa; font-weight: bold; }
                button { background-color: #3730a3; color: #fff; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; }
                button:hover { background-color: #312e81; }
                .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                .logout-btn { background-color: #dc2626; padding: 8px 12px; font-size: 12px; }
                .logout-btn:hover { background-color: #b91c1c; }
                .click-badge { background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 20px; font-weight: bold; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header-row">
                    <div>
                        <h1 style="margin: 0; letter-spacing: 2px;">TESSR ADMIN</h1>
                        <a href="/" style="color: #666; text-decoration: none; font-size: 14px;">&larr; Back to Generator</a>
                    </div>
                    <button class="logout-btn" onclick="logout()">Logout</button>
                </div>
                
                <table id="linksTable">
                    <thead>
                        <tr>
                            <th>Short ID</th>
                            <th>Current Destination</th>
                            <th>Scans</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        </tbody>
                </table>
            </div>

            <script>
                async function loadLinks() {
                    const response = await fetch('/api/links');
                    if (response.status === 401) window.location.href = '/login'; // Kicked out!
                    const links = await response.json();
                    const tbody = document.querySelector('#linksTable tbody');
                    tbody.innerHTML = '';

                    if (links.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">No dynamic links generated yet.</td></tr>';
                        return;
                    }

                    links.forEach(link => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = \`
                            <td><strong>\${link.shortId}</strong><br><small style="color:#888">/r/\${link.shortId}</small></td>
                            <td><a href="\${link.targetUrl}" target="_blank" style="color:#3730a3; text-decoration:none; word-break: break-all;">\${link.targetUrl}</a></td>
                            <td><span class="click-badge">\${link.clicks}</span></td>
                            <td><button onclick="editLink('\${link.shortId}', '\${link.targetUrl}')">✏️ Edit</button></td>
                        \`;
                        tbody.appendChild(tr);
                    });
                }

                async function editLink(id, currentUrl) {
                    const newUrl = prompt("Enter the new destination URL:", currentUrl);
                    if (newUrl && newUrl !== currentUrl) {
                        const response = await fetch('/api/edit-link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: id, newUrl: newUrl })
                        });
                        if (response.ok) loadLinks(); 
                        else alert("Failed to update link.");
                    }
                }

                async function logout() {
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.href = '/login';
                }

                loadLinks();
            </script>
        </body>
        </html>
    `);
});

// --- LOCKED DOWN API ENDPOINTS ---
// Notice the bouncer is here too, protecting the raw data.
app.get('/api/links', requireAuth, async (req, res) => {
    try {
        const links = await Link.find({}).sort({ _id: -1 });
        res.json(links);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch' });
    }
});

app.post('/api/edit-link', requireAuth, async (req, res) => {
    try {
        const { id, newUrl } = req.body;
        await Link.findOneAndUpdate({ shortId: id }, { targetUrl: newUrl });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// --- THE FRONTEND UI (Generator) ---
// (This remains entirely unchanged so the public can still generate codes)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>TESSR | Pro Creator</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 40px; background-color: #f4f4f9; color: #333; }
                .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); display: inline-block; text-align: left; width: 100%; max-width: 450px; box-sizing: border-box; }
                input[type="text"], input[type="email"], input[type="tel"], select, button, input[type="file"], textarea { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 20px; border-radius: 6px; border: 1px solid #ddd; box-sizing: border-box; font-size: 14px; }
                input[type="range"] { width: 100%; margin-top: 8px; margin-bottom: 20px; cursor: pointer; }
                button { background-color: #000; color: #fff; border: none; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
                button:hover { background-color: #333; }
                .flex-row { display: flex; gap: 15px; }
                .flex-row div { width: 100%; }
                canvas { border: 1px solid #eee; border-radius: 10px; margin-top: 20px; max-width: 100%; display: none; margin-left: auto; margin-right: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                #downloadBtn { display: none; text-align: center; padding: 15px; background-color: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
                .section { display: none; }
                .active-section { display: block; }
                .dynamic-toggle { background: #eef2ff; padding: 15px; border-radius: 6px; border: 1px solid #c7d2fe; margin-bottom: 20px; }
                .admin-link { display: block; text-align: center; margin-top: 20px; color: #888; text-decoration: none; font-size: 12px; }
                .admin-link:hover { color: #3730a3; }
            </style>
        </head>
        <body>
            <h1 style="margin-bottom: 5px; letter-spacing: 2px;">TESSR PRO</h1>
            <p style="color: #666; margin-top: 0; margin-bottom: 30px;">Dynamic & Bulk Generation Engine</p>
            
            <div class="container">
                <label><b>1. Payload Type:</b></label>
                <select id="dataType" onchange="toggleInputs()">
                    <option value="url">Single URL / Text</option>
                    <option value="bulk">Bulk Generation (List of URLs)</option>
                    <option value="wifi">Wi-Fi Network</option>
                    <option value="vcard">Digital Business Card</option>
                </select>

                <div class="dynamic-toggle" id="dynamicWrapper">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: bold; color: #3730a3;">
                        <input type="checkbox" id="isDynamic" style="width: 20px; height: 20px; margin: 0;">
                        Make Link Dynamic (Trackable & Editable)
                    </label>
                    <p style="margin: 5px 0 0 30px; font-size: 12px; color: #6b7280;">TESSR will generate a short-link that redirects to your destination.</p>
                </div>

                <div id="urlSection" class="section active-section">
                    <label><b>Enter Destination URL:</b></label>
                    <input type="text" id="userInput" placeholder="https://lexentra.com">
                </div>

                <div id="bulkSection" class="section">
                    <label><b>Paste URLs (One per line):</b></label>
                    <textarea id="bulkInput" rows="6" placeholder="https://google.com&#10;https://lexentra.com&#10;https://tessr.com"></textarea>
                    <p style="font-size: 12px; color: #666; margin-top: -10px;">TESSR will generate a .zip file containing a custom QR code for every link.</p>
                </div>

                <div id="wifiSection" class="section">
                    <label><b>Network Name (SSID):</b></label><input type="text" id="wifiName">
                    <label><b>Password:</b></label><input type="text" id="wifiPassword">
                </div>

                <div id="vcardSection" class="section">
                    <div class="flex-row">
                        <div><label><b>First:</b></label><input type="text" id="vcardFirst"></div>
                        <div><label><b>Last:</b></label><input type="text" id="vcardLast"></div>
                    </div>
                    <label><b>Phone:</b></label><input type="tel" id="vcardPhone">
                </div>

                <hr style="border: 0; height: 1px; background: #eee; margin: 25px 0;">

                <div class="flex-row">
                    <div><label><b>QR Color:</b></label><input type="color" id="darkColor" value="#000000" style="padding: 0; height: 40px;"></div>
                    <div><label><b>Background:</b></label><input type="color" id="lightColor" value="#ffffff" style="padding: 0; height: 40px;"></div>
                </div>

                <label><b>Export Quality:</b></label>
                <select id="qrSize">
                    <option value="400">Standard (400px)</option>
                    <option value="1000">Print Quality (1000px)</option>
                </select>

                <button type="button" onclick="generateQR()" id="genBtn">Generate</button>

                <canvas id="qrCanvas"></canvas>
                <a id="downloadBtn">⬇️ Download</a>
            </div>
            
            <a href="/admin" class="admin-link">Access Admin Dashboard</a>

            <script>
                function toggleInputs() {
                    const type = document.getElementById("dataType").value;
                    const sections = ['url', 'bulk', 'wifi', 'vcard'];
                    sections.forEach(sec => document.getElementById(sec + "Section").style.display = "none");
                    document.getElementById(type + "Section").style.display = "block";

                    const dynWrap = document.getElementById("dynamicWrapper");
                    dynWrap.style.display = (type === 'url' || type === 'bulk') ? 'block' : 'none';
                }

                async function generateQR() {
                    const type = document.getElementById("dataType").value;
                    const isDynamic = document.getElementById("isDynamic").checked;
                    const btn = document.getElementById("genBtn");
                    btn.innerText = "Processing...";

                    let payload = "";
                    let isBulkRequest = false;
                    let bulkArray = [];

                    if (type === "url") {
                        payload = document.getElementById("userInput").value;
                    } else if (type === "bulk") {
                        isBulkRequest = true;
                        const rawLines = document.getElementById("bulkInput").value.split('\\n');
                        bulkArray = rawLines.filter(line => line.trim() !== "");
                    } else if (type === "wifi") {
                        payload = \`WIFI:T:WPA;S:\${document.getElementById("wifiName").value};P:\${document.getElementById("wifiPassword").value};;\`;
                    } else if (type === "vcard") {
                        payload = \`BEGIN:VCARD\\nVERSION:3.0\\nN:\${document.getElementById("vcardLast").value};\${document.getElementById("vcardFirst").value}\\nTEL:\${document.getElementById("vcardPhone").value}\\nEND:VCARD\`;
                    }

                    const apiEndpoint = isBulkRequest ? '/api/bulk' : '/api/generate';
                    const requestBody = {
                        data: isBulkRequest ? bulkArray : payload,
                        isDynamic: isDynamic,
                        darkColor: document.getElementById("darkColor").value,
                        lightColor: document.getElementById("lightColor").value,
                        size: document.getElementById("qrSize").value
                    };

                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                    
                    const result = await response.json();

                    if (isBulkRequest) {
                        document.getElementById("qrCanvas").style.display = "none";
                        const dlBtn = document.getElementById("downloadBtn");
                        dlBtn.style.display = "block";
                        dlBtn.href = result.zipFile; 
                        dlBtn.download = "TESSR-Bulk-Export.zip";
                        dlBtn.innerText = "⬇️ Download Bulk .ZIP";
                        btn.innerText = "Generate";
                    } else {
                        const canvas = document.getElementById("qrCanvas");
                        const ctx = canvas.getContext("2d");
                        const size = parseInt(document.getElementById("qrSize").value);
                        canvas.width = size; canvas.height = size;

                        const qrImg = new Image();
                        qrImg.src = result.qrImage;
                        qrImg.onload = () => {
                            ctx.drawImage(qrImg, 0, 0, size, size);
                            canvas.style.display = "block";
                            const dlBtn = document.getElementById("downloadBtn");
                            dlBtn.style.display = "block";
                            dlBtn.href = canvas.toDataURL("image/png"); 
                            dlBtn.download = "tessr-qr.png";
                            dlBtn.innerText = "⬇️ Download Image";
                            btn.innerText = "Generate";
                        };
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// --- GENERATOR APIS ---
app.post('/api/generate', async (req, res) => {
    try {
        let finalPayload = req.body.data;

        if (req.body.isDynamic && finalPayload.startsWith('http')) {
            const id = uuidv4().slice(0, 6);
            await Link.create({ shortId: id, targetUrl: finalPayload });
            const host = req.get('host');
            const protocol = host.includes('localhost') ? 'http' : 'https';
            finalPayload = `${protocol}://${host}/r/${id}`;
        }

        const options = { width: parseInt(req.body.size), margin: 2, errorCorrectionLevel: 'H', color: { dark: req.body.darkColor, light: req.body.lightColor } };
        const qrImage = await QRCode.toDataURL(finalPayload, options);
        res.json({ qrImage: qrImage }); 
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/bulk', async (req, res) => {
    try {
        const { data: urls, isDynamic, darkColor, lightColor, size } = req.body;
        const zip = new JSZip(); 
        const host = req.get('host');
        const protocol = host.includes('localhost') ? 'http' : 'https';

        for (let i = 0; i < urls.length; i++) {
            let finalPayload = urls[i];

            if (isDynamic && finalPayload.startsWith('http')) {
                const id = uuidv4().slice(0, 6);
                await Link.create({ shortId: id, targetUrl: finalPayload });
                finalPayload = `${protocol}://${host}/r/${id}`;
            }

            const options = { width: parseInt(size), margin: 2, errorCorrectionLevel: 'H', color: { dark: darkColor, light: lightColor } };
            const qrDataURL = await QRCode.toDataURL(finalPayload, options);
            const base64Data = qrDataURL.split(',')[1];
            zip.file(`tessr-qr-${i + 1}.png`, base64Data, { base64: true });
        }

        const content = await zip.generateAsync({ type: 'base64' });
        res.json({ zipFile: `data:application/zip;base64,${content}` });
    } catch (err) {
        res.status(500).json({ error: 'Bulk generation failed' });
    }
});

app.listen(port, () => {
    console.log(`🚀 TESSR Server is running! Open http://localhost:${port}`);
});