# 📱 Complete Guide: QR Code & .start File System

## 🎯 What These Features Do

### QR Code System
**Purpose:** Share motor configurations instantly by scanning a QR code
**Use Case:** Print reports → Field technicians scan → Config loads automatically

### .start File System  
**Purpose:** Download/upload motor configurations as portable files
**Use Case:** Email configs to colleagues, backup configurations, version control

---

## 🔧 How It Works Technically

### Part 1: QR Code Generation

**Library Used:** `qrcode@1.5.3` from CDN
```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

**Data Flow:**
```
1. User clicks "Save to PDF"
2. Collect all motor data (kW, FLC, RPM, curves, etc.)
3. Convert to JSON object
4. Encode as base64
5. Create URL: yourapp.com/index.html?config=BASE64_DATA
6. Generate QR code containing this URL
7. Display QR code on page
8. Print includes QR code
```

**Code Implementation:**
```javascript
// Step 1: Collect data
const motorData = {
    kw: document.getElementById('mKW').value,
    flc: document.getElementById('mFLC').value,
    mt: [...document.querySelectorAll('.val-mt')].map(e => e.value).join(','),
    // ... all other fields
};

// Step 2: Create URL with encoded data
const baseUrl = window.location.origin + '/index.html';
const encodedData = encodeURIComponent(btoa(JSON.stringify(motorData)));
const dataUrl = baseUrl + '?config=' + encodedData;

// Step 3: Generate QR code
await QRCode.toCanvas(canvas, dataUrl, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M'
});
```

**URL Format:**
```
https://yourapp.com/index.html?config=eyJrdyI6IjQ1MCIsImZsYyI6IjQ4IiwicnBtIjoiMTQ4NSIsInBvbGVzIjoiNCIsImZyZXEiOiI1MCIsInN0YWxsIjoiMTUiLCJzZXJ2aWNlRmFjdG9yIjoiMS4wIiwic3lzdGVtVm9sdGFnZSI6IjEwMCIsIm1vdG9ySiI6IjEuOTYiLCJsb2FkSiI6IjEzLjc0IiwibXQiOiIxODgsMTAyLDEwMCw5OCw5NSw5Mi44OSw4Nyw4NCw4MSw3OCw3NSw3Miw2OSw2Niw2Myw2MCw1Nyw1NCw1MSw0OCw0NSw0Miw0MCwzOSwzOCwzNywzNiwzNSwzNCwzMywzMiwzMSwzMCwyOSwyOCwyNyIsIm1jIjoiNTkwLDU0MCw1MjUsNTEwLDQ5NSw0ODAiLCJsdCI6IjAsMjAsMjUsMzAsMzUsMzgsNDAsNDIsNDUsNDgsNTAsNTUsNjAsNjUsNzAsNzUsODAsODUsOTAsOTUsOTksOTksOTksOTksOTksOTksOTksOTksOTksOTksOTksOTksOTksOTksOTksOTkifQ==
```

### Part 2: Import from QR Code

**On Page Load:**
```javascript
function checkForConfigImport() {
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');
    
    if (configParam) {
        // Decode base64
        const json = atob(decodeURIComponent(configParam));
        const motorData = JSON.parse(json);
        
        // Import all fields
        importMotorConfig(motorData);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}
```

**User Experience:**
1. User scans QR code with phone
2. Phone opens URL in browser
3. Page loads with ?config=... parameter
4. JavaScript detects parameter
5. Decodes and parses data
6. Auto-populates all fields
7. Shows success message
8. Removes parameter from URL

---

### Part 3: .start File System

**File Format:**
```json
{
  "kw": "450",
  "flc": "48",
  "rpm": "1485",
  "poles": "4",
  "freq": "50",
  "stall": "15",
  "serviceFactor": "1.0",
  "systemVoltage": "100",
  "motorJ": "1.96",
  "loadJ": "13.74",
  "mt": "188,102,100,98,95,92,89,87,84,81,78,75,72,69,66,63,60,57,54,51,48,45,42,40,39,38,37,36,35,34,33,32,31,30,29,28,27",
  "mc": "590,540,525,510,495,480,465,450,435,420,405,390,375,360,345,330,315,300,285,270,255,240,225,210,195,180,165,150,135,120,105,90,75,60,45,30,15",
  "lt": "0,20,25,30,35,38,40,42,45,48,50,55,60,65,70,75,80,85,90,95,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99"
}
```

**Download Implementation:**
```javascript
function downloadStartFile(motorData) {
    // 1. Convert to JSON string (pretty print)
    const content = JSON.stringify(motorData, null, 2);
    
    // 2. Create Blob
    const blob = new Blob([content], { type: 'application/json' });
    
    // 3. Create download URL
    const url = URL.createObjectURL(blob);
    
    // 4. Create temporary <a> tag
    const a = document.createElement('a');
    a.href = url;
    a.download = `motor_${motorData.kw}kW_${Date.now()}.start`;
    
    // 5. Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 6. Cleanup
    URL.revokeObjectURL(url);
}
```

**Upload Implementation:**
```html
<!-- Hidden file input -->
<input type="file" id="importStartFile" accept=".start,.json" style="display:none;">

<!-- Visible button -->
<button onclick="document.getElementById('importStartFile').click()">
    Import .start File
</button>
```

```javascript
// File change handler
document.getElementById('importStartFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const motorData = JSON.parse(e.target.result);
        importMotorConfig(motorData);
    };
    reader.readAsText(file);
});
```

---

## 📋 Complete Data Structure

**What's Included:**
```javascript
{
    // Motor Parameters
    "kw": "450",           // Power
    "flc": "48",           // Full load current
    "rpm": "1485",         // Rated speed
    "poles": "4",          // Number of poles
    "freq": "50",          // Frequency
    "stall": "15",         // Hot stall time
    "serviceFactor": "1.0", // Service factor
    "systemVoltage": "100", // System voltage %
    "motorJ": "1.96",      // Motor inertia
    "loadJ": "13.74",      // Load inertia
    
    // Curve Data (comma-separated strings)
    "mt": "188,102,100...", // Motor torque curve (36 points)
    "mc": "590,540,525...", // Motor current curve (36 points)
    "lt": "0,20,25,30...",  // Load torque curve (36 points)
}
```

**Why Strings for Curves?**
- Easier to encode in URL (for QR codes)
- Simpler JSON structure
- Parse with: `data.mt.split(',').map(Number)`

---

## 🚨 Troubleshooting

### Issue: "QR Code generation unavailable"

**Cause:** QRCode library not loaded

**Fix 1 - Check Library:**
```html
<!-- Must be in <head> before closing </head> -->
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

**Fix 2 - Add Delay:**
```javascript
// Wait for library to load
await new Promise(resolve => setTimeout(resolve, 50));
await QRCode.toCanvas(canvas, dataUrl, options);
```

**Fix 3 - Check Console:**
```javascript
console.log('QRCode available?', typeof QRCode !== 'undefined');
```

### Issue: Download button doesn't work

**Cause:** Event handler not attached properly

**Fix - Use Button Click Directly:**
```javascript
// Create button element
const btn = document.createElement('button');
btn.textContent = 'Download .start File';

// Attach handler IMMEDIATELY
btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    downloadStartFile(motorData);
    return false;
};
```

**Alternative - Clone to Remove Old Handlers:**
```javascript
const oldBtn = document.getElementById('downloadBtn');
const newBtn = oldBtn.cloneNode(true);
oldBtn.parentNode.replaceChild(newBtn, oldBtn);
newBtn.onclick = () => downloadStartFile(data);
```

### Issue: QR code not visible in print

**Cause:** Display:none CSS or hidden container

**Fix - Print CSS:**
```css
@media print {
    #qrCodeContainer {
        display: block !important;
        page-break-before: always;
    }
}
```

### Issue: Config doesn't import from URL

**Cause:** Special characters in base64 not URL-encoded

**Fix - Proper Encoding:**
```javascript
// WRONG
const url = baseUrl + '?config=' + btoa(JSON.stringify(data));

// RIGHT
const url = baseUrl + '?config=' + encodeURIComponent(btoa(JSON.stringify(data)));

// Decode properly
const decoded = atob(decodeURIComponent(configParam));
```

---

## 🎓 How to Use in Future Projects

### Step 1: Install QR Library

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

### Step 2: Create Export Function

```javascript
async function exportConfig() {
    // 1. Collect your app data
    const data = {
        field1: document.getElementById('input1').value,
        field2: document.getElementById('input2').value,
        // ... all your fields
    };
    
    // 2. Create URL
    const baseUrl = window.location.origin + '/index.html';
    const encoded = encodeURIComponent(btoa(JSON.stringify(data)));
    const url = baseUrl + '?config=' + encoded;
    
    // 3. Generate QR
    const canvas = document.getElementById('qrCanvas');
    await QRCode.toCanvas(canvas, url, {
        width: 200,
        errorCorrectionLevel: 'M'
    });
    
    // 4. Create download file
    const blob = new Blob([JSON.stringify(data, null, 2)], 
                          { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'config.myext'; // Use your extension
    a.click();
    URL.revokeObjectURL(downloadUrl);
}
```

### Step 3: Create Import Function

```javascript
function checkForConfigImport() {
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');
    
    if (configParam) {
        const data = JSON.parse(atob(decodeURIComponent(configParam)));
        loadConfig(data);
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function loadConfig(data) {
    document.getElementById('input1').value = data.field1;
    document.getElementById('input2').value = data.field2;
    // ... populate all fields
}

// Call on page load
window.addEventListener('DOMContentLoaded', checkForConfigImport);
```

### Step 4: File Upload Handler

```html
<input type="file" id="fileInput" accept=".myext,.json" style="display:none">
<button onclick="document.getElementById('fileInput').click()">Import</button>
```

```javascript
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = JSON.parse(event.target.result);
        loadConfig(data);
    };
    reader.readAsText(file);
});
```

---

## 💡 Best Practices

### 1. Data Validation
```javascript
function loadConfig(data) {
    // Validate before importing
    if (!data.kw || !data.rpm) {
        alert('Invalid config file');
        return;
    }
    
    // Import only valid fields
    if (data.kw) document.getElementById('mKW').value = data.kw;
}
```

### 2. Error Handling
```javascript
try {
    const data = JSON.parse(atob(decodeURIComponent(configParam)));
    loadConfig(data);
} catch (err) {
    console.error('Import failed:', err);
    alert('Invalid configuration data');
}
```

### 3. User Feedback
```javascript
function loadConfig(data) {
    // Import data
    // ...
    
    // Show success
    alert('✅ Configuration loaded!\n\nMotor: ' + data.kw + ' kW');
}
```

### 4. Clean URLs After Import
```javascript
// Remove config parameter from URL after import
window.history.replaceState({}, document.title, window.location.pathname);
```

### 5. QR Code Size for Print
```javascript
// Screen: 200px
// Print: 180-200px (good scanning size)
await QRCode.toCanvas(canvas, url, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M' // Medium = 15% error correction
});
```

---

## 📱 Mobile App Integration

If you want a mobile app to handle .start files:

**iOS (Info.plist):**
```xml
<key>CFBundleDocumentTypes</key>
<array>
    <dict>
        <key>CFBundleTypeName</key>
        <string>Motor Configuration</string>
        <key>LSItemContentTypes</key>
        <array>
            <string>public.json</string>
        </array>
        <key>CFBundleTypeExtensions</key>
        <array>
            <string>start</string>
        </array>
    </dict>
</array>
```

**Android (AndroidManifest.xml):**
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/json" />
    <data android:pathPattern=".*\\.start" />
</intent-filter>
```

---

## ✅ Testing Checklist

```
□ QR code generates without errors
□ QR code is scannable (test with phone)
□ Scanning QR opens app with config loaded
□ .start file downloads successfully
□ .start file has .start extension
□ .start file contains valid JSON
□ Import button accepts .start files
□ Uploading .start file loads config
□ All fields populate correctly after import
□ Console shows no errors
□ Print includes QR code
□ QR code is visible on printed page
```

---

## 🎯 Summary

**QR Code System:**
- Encodes config as base64 in URL
- Generates scannable QR code
- Auto-imports when scanned
- Perfect for field work

**.start File System:**
- JSON file with custom extension
- Download/upload via buttons
- Perfect for sharing/backup
- Works across devices

**Both systems use the same data structure and import function!**
