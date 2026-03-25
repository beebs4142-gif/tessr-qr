const express = require('express');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TESSR | Absolute QR</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 40px; background-color: #f4f4f9; color: #333; }
                .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); display: inline-block; text-align: left; width: 100%; max-width: 450px; box-sizing: border-box; }
                input[type="text"], input[type="email"], input[type="tel"], select, button, input[type="file"] { width: 100%; padding: 12px; margin-top: 8px; margin-bottom: 20px; border-radius: 6px; border: 1px solid #ddd; box-sizing: border-box; font-size: 14px; }
                input[type="range"] { width: 100%; margin-top: 8px; margin-bottom: 20px; cursor: pointer; }
                button { background-color: #000; color: #fff; border: none; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
                button:hover { background-color: #333; }
                .flex-row { display: flex; gap: 15px; }
                .flex-row div { width: 100%; }
                canvas { border: 1px solid #eee; border-radius: 10px; margin-top: 20px; max-width: 100%; display: none; margin-left: auto; margin-right: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                #downloadBtn { display: none; text-align: center; padding: 15px; background-color: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
                .section { display: none; }
                .active-section { display: block; }
            </style>
        </head>
        <body>
            <h1 style="margin-bottom: 5px; letter-spacing: 2px;">TESSR</h1>
            <p style="color: #666; margin-top: 0; margin-bottom: 30px;">The Absolute Creator</p>
            
            <div class="container">
                <label><b>1. Payload Type:</b></label>
                <select id="dataType" onchange="toggleInputs()">
                    <option value="url">Website URL / Plain Text</option>
                    <option value="wifi">Wi-Fi Network</option>
                    <option value="vcard">Digital Business Card (vCard)</option>
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="email">Pre-Addressed Email</option>
                </select>

                <div id="urlSection" class="section active-section">
                    <label><b>Enter URL/Text:</b></label>
                    <input type="text" id="userInput" placeholder="https://...">
                </div>

                <div id="wifiSection" class="section">
                    <label><b>Network Name (SSID):</b></label>
                    <input type="text" id="wifiName" placeholder="My_Network">
                    <label><b>Password:</b></label>
                    <input type="text" id="wifiPassword" placeholder="SecretPassword">
                </div>

                <div id="vcardSection" class="section">
                    <div class="flex-row">
                        <div><label><b>First Name:</b></label><input type="text" id="vcardFirst" placeholder="Jane"></div>
                        <div><label><b>Last Name:</b></label><input type="text" id="vcardLast" placeholder="Doe"></div>
                    </div>
                    <label><b>Company / Agency:</b></label>
                    <input type="text" id="vcardCompany" placeholder="Lexentra">
                    <label><b>Phone Number:</b></label>
                    <input type="tel" id="vcardPhone" placeholder="+1234567890">
                    <label><b>Email:</b></label>
                    <input type="email" id="vcardEmail" placeholder="hello@lexentra.com">
                </div>

                <div id="whatsappSection" class="section">
                    <label><b>Phone Number (with country code):</b></label>
                    <input type="tel" id="waPhone" placeholder="919876543210">
                    <label><b>Pre-filled Message:</b></label>
                    <input type="text" id="waMessage" placeholder="Hi, I'd like a quote for a logo design!">
                </div>

                <div id="emailSection" class="section">
                    <label><b>Send To (Email Address):</b></label>
                    <input type="email" id="emailTo" placeholder="support@lexentra.com">
                    <label><b>Subject Line:</b></label>
                    <input type="text" id="emailSubj" placeholder="Project Inquiry">
                    <label><b>Body Message:</b></label>
                    <input type="text" id="emailBody" placeholder="I am interested in your services...">
                </div>

                <hr style="border: 0; height: 1px; background: #eee; margin: 25px 0;">

                <div class="flex-row">
                    <div>
                        <label><b>QR Color:</b></label>
                        <input type="color" id="darkColor" value="#000000" style="padding: 0; height: 40px; cursor: pointer;">
                    </div>
                    <div>
                        <label><b>Background:</b></label>
                        <input type="color" id="lightColor" value="#ffffff" style="padding: 0; height: 40px; cursor: pointer;">
                    </div>
                </div>

                <label><b>3. Brand Logo (Optional):</b></label>
                <input type="file" id="logoInput" accept="image/png, image/jpeg">

                <label><b>Logo Size:</b> <span id="logoSizeLabel">20%</span></label>
                <input type="range" id="logoSize" min="10" max="30" value="20" oninput="updateLabel()">

                <label><b>4. Export Quality:</b></label>
                <select id="qrSize">
                    <option value="400">Standard (400px)</option>
                    <option value="1000">Print Quality (1000px)</option>
                </select>

                <button type="button" onclick="generateQR()">Generate TESSR Code</button>

                <canvas id="qrCanvas"></canvas>
                <a id="downloadBtn" download="tessr-branded-qr.png">⬇️ Download Branded Code</a>
            </div>

            <script>
                // A much cleaner way to switch between all our new sections
                function toggleInputs() {
                    const type = document.getElementById("dataType").value;
                    const sections = ['url', 'wifi', 'vcard', 'whatsapp', 'email'];
                    
                    sections.forEach(sec => {
                        document.getElementById(sec + "Section").style.display = "none";
                    });
                    
                    document.getElementById(type + "Section").style.display = "block";
                }

                function updateLabel() {
                    document.getElementById("logoSizeLabel").innerText = document.getElementById("logoSize").value + "%";
                }

                async function generateQR() {
                    const type = document.getElementById("dataType").value;
                    let payload = "";
                    
                    // The "Brain" formatting logic for every data type
                    if (type === "url") {
                        payload = document.getElementById("userInput").value || "https://tessr.com";
                    } else if (type === "wifi") {
                        const ssid = document.getElementById("wifiName").value;
                        const pass = document.getElementById("wifiPassword").value;
                        payload = \`WIFI:T:WPA;S:\${ssid};P:\${pass};;\`;
                    } else if (type === "vcard") {
                        const fName = document.getElementById("vcardFirst").value;
                        const lName = document.getElementById("vcardLast").value;
                        const comp = document.getElementById("vcardCompany").value;
                        const phone = document.getElementById("vcardPhone").value;
                        const email = document.getElementById("vcardEmail").value;
                        payload = \`BEGIN:VCARD\\nVERSION:3.0\\nN:\${lName};\${fName}\\nORG:\${comp}\\nTEL:\${phone}\\nEMAIL:\${email}\\nEND:VCARD\`;
                    } else if (type === "whatsapp") {
                        const phone = document.getElementById("waPhone").value;
                        const msg = encodeURIComponent(document.getElementById("waMessage").value);
                        payload = \`https://wa.me/\${phone}?text=\${msg}\`;
                    } else if (type === "email") {
                        const to = document.getElementById("emailTo").value;
                        const subj = encodeURIComponent(document.getElementById("emailSubj").value);
                        const body = encodeURIComponent(document.getElementById("emailBody").value);
                        payload = \`mailto:\${to}?subject=\${subj}&body=\${body}\`;
                    }

                    const response = await fetch('/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            data: payload,
                            darkColor: document.getElementById("darkColor").value,
                            lightColor: document.getElementById("lightColor").value,
                            size: document.getElementById("qrSize").value
                        })
                    });
                    
                    const result = await response.json();

                    const canvas = document.getElementById("qrCanvas");
                    const ctx = canvas.getContext("2d");
                    const size = parseInt(document.getElementById("qrSize").value);
                    canvas.width = size;
                    canvas.height = size;

                    const qrImg = new Image();
                    qrImg.src = result.qrImage;
                    qrImg.onload = () => {
                        ctx.drawImage(qrImg, 0, 0, size, size);

                        const logoFile = document.getElementById("logoInput").files[0];
                        if (logoFile) {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                const logoImg = new Image();
                                logoImg.src = e.target.result;
                                logoImg.onload = () => {
                                    const sizeMultiplier = parseInt(document.getElementById("logoSize").value) / 100;
                                    const logoSize = size * sizeMultiplier; 
                                    const center = (size - logoSize) / 2;
                                    
                                    const padding = size * 0.03; 
                                    const borderRadius = size * 0.04; 
                                    
                                    ctx.fillStyle = document.getElementById("lightColor").value;
                                    ctx.beginPath();
                                    ctx.roundRect(
                                        center - padding, 
                                        center - padding, 
                                        logoSize + (padding * 2), 
                                        logoSize + (padding * 2), 
                                        borderRadius
                                    );
                                    ctx.fill();
                                    
                                    ctx.drawImage(logoImg, center, center, logoSize, logoSize);
                                    showResult(canvas);
                                }
                            }
                            reader.readAsDataURL(logoFile);
                        } else {
                            showResult(canvas);
                        }
                    };
                }

                function showResult(canvas) {
                    canvas.style.display = "block";
                    const dlBtn = document.getElementById("downloadBtn");
                    dlBtn.style.display = "block";
                    dlBtn.href = canvas.toDataURL("image/png"); 
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/api/generate', async (req, res) => {
    try {
        const options = {
            width: parseInt(req.body.size),
            margin: 2,
            errorCorrectionLevel: 'H', 
            color: { dark: req.body.darkColor, light: req.body.lightColor }
        };
        const qrImage = await QRCode.toDataURL(req.body.data, options);
        res.json({ qrImage: qrImage }); 
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.listen(port, () => {
    console.log(`🚀 TESSR Server is running! Open http://localhost:${port}`);
});