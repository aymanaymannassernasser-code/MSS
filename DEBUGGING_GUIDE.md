# 🔧 Quick Fix Guide - Current Issues

## Issue 1: "QR Code generation unavailable"

### Diagnosis Steps

**1. Open Browser Console (F12)**
```javascript
// Type this in console:
typeof QRCode
// Should show: "object" or "function"
// If shows: "undefined" → Library not loaded
```

**2. Check Network Tab**
- Open Dev Tools → Network tab
- Look for: `qrcode.min.js`
- Status should be: 200 OK
- If 404 or failed → CDN problem

**3. Check Script Order**
```html
<!-- QRCode library MUST load before app.js uses it -->
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<script src="app.js"></script> <!-- This uses QRCode -->
```

### The Fix (Already Applied)

**Added proper error handling:**
```javascript
// Wait for library to be ready
await new Promise(resolve => setTimeout(resolve, 50));

// Check if loaded
if (typeof QRCode === 'undefined') {
    throw new Error('QRCode library not loaded');
}

// Generate QR
await QRCode.toCanvas(canvas, dataUrl, options);
```

**Console will now show:**
- ✅ `QR code generated successfully` (if working)
- ❌ `QR generation error: ...` (if failed)

### Test It

1. Click "Save to PDF"
2. Check console for messages
3. QR should appear at bottom
4. If error, console shows exact problem

---

## Issue 2: Download Button Doesn't Work

### Why It Happened

**Problem:** Event handler attached to innerHTML-generated button doesn't persist.

**Solution:** Replace with proper button creation:

```javascript
// OLD (doesn't work reliably)
qrContainer.innerHTML = '<button onclick="...">Download</button>';

// NEW (works)
const btn = document.createElement('button');
btn.onclick = (e) => {
    e.preventDefault();
    downloadStartFile(motorData);
};
```

### The Fix (Already Applied)

**Button is now created properly and handler attached directly:**

```javascript
// 1. Create container with button
qrContainer.innerHTML = `
    <button id="downloadStartBtn">💾 Download .start File</button>
`;

// 2. Get reference to button
const downloadBtn = document.getElementById('downloadStartBtn');

// 3. Clone to remove old handlers (fresh start)
downloadBtn.replaceWith(downloadBtn.cloneNode(true));

// 4. Get new reference
const newBtn = document.getElementById('downloadStartBtn');

// 5. Attach handler directly
newBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    downloadStartFile(motorData);
    return false;
};
```

### Test It

1. Click "Save to PDF"
2. You should see QR code appear
3. Below QR, there's a button: "💾 Download .start File"
4. Click button
5. File should download immediately
6. Check Downloads folder for: `motor_450kW_TIMESTAMP.start`

---

## Issue 3: Print Layout (Results + Chart Separate)

### The Problem

- Results: ~200px height
- Chart: 450px height
- Total: 650px
- A4 page: ~800px available
- Margins: 15mm × 4 = 60mm = ~226px
- Available: 574px
- **Chart doesn't fit!**

### The Fix (Already Applied)

**Reduced chart height for print:**
```css
@media print {
    .chart-container {
        height: 320px !important; /* Was 450px */
    }
    
    .card {
        padding: 15px !important; /* Was 22px */
        margin-bottom: 10px !important; /* Was 15px */
    }
    
    .result-item {
        padding: 10px !important; /* Was 14px */
    }
}
```

**New calculation:**
- Results: ~150px (compressed)
- Chart: 320px (reduced)
- Margins: ~80px
- Total: 550px ✅ Fits on one page!

### Test It

1. Click "Save to PDF"
2. In print preview:
   - Page 1: Results + Chart (together!)
   - Page 2: QR code
   - Page 3: Data table (if visible)

---

## Complete Test Procedure

### Test 1: QR Code Generation

```
1. Open app
2. Configure a motor (any values)
3. Click "Save to PDF"
4. Open browser console (F12)
5. Look for: "✅ QR code generated successfully"
6. Look at page: QR code should be visible
7. Scan with phone: Should open URL
```

**Expected Result:**
- QR code appears
- Console shows success
- Scanning opens app

### Test 2: .start File Download

```
1. Click "Save to PDF" (if not already open)
2. See QR section with download button
3. Click "💾 Download .start File"
4. Check Downloads folder
5. File named: motor_XXXkW_TIMESTAMP.start
6. Open file in text editor
7. Should see valid JSON
```

**Expected Result:**
- File downloads
- Has .start extension
- Contains JSON with motor data
- Alert shows success message

### Test 3: .start File Import

```
1. Configure motor A (e.g., 450 kW)
2. Download .start file
3. Change motor config (e.g., 250 kW)
4. Click "Import .start File" button
5. Select the .start file you downloaded
6. Config should revert to motor A (450 kW)
7. Alert shows: "✅ Configuration imported successfully!"
```

**Expected Result:**
- All fields restore to saved values
- Curves restore correctly
- Alert confirms import

### Test 4: Print Layout

```
1. Configure motor
2. Run simulation (DOL or Soft Start)
3. Click "Save to PDF"
4. Open print preview (Ctrl+P)
5. Check layout:
   - Page 1: Results AND chart (together)
   - Page 2: QR code
   - Chart is not cut off
   - Everything is readable
```

**Expected Result:**
- Results + chart on page 1
- QR code on page 2
- Professional appearance
- No overflow

---

## Console Commands for Debugging

**Check QR Library:**
```javascript
console.log('QRCode:', typeof QRCode);
// Should show: "object" or "function"
```

**Test QR Generation Manually:**
```javascript
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
QRCode.toCanvas(canvas, 'https://example.com', {width: 200})
    .then(() => console.log('QR works!'))
    .catch(err => console.error('QR failed:', err));
```

**Test .start File Download:**
```javascript
const data = {test: "data"};
const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'test.start';
a.click();
// Should download test.start file
```

**Check Import Function:**
```javascript
// Create test data
const testData = {
    kw: "999",
    flc: "99",
    rpm: "1500"
};

// Try import
importMotorConfig(testData);

// Check if it worked
console.log('kW field:', document.getElementById('mKW').value);
// Should show: "999"
```

---

## What To Look For

### ✅ SUCCESS INDICATORS

**QR Code:**
- Console: "✅ QR code generated successfully"
- Visual: Black and white QR code visible
- Scanning: Opens URL with ?config=...

**.start Download:**
- Console: "✅ .start file downloaded: motor_..."
- Downloads: File appears with .start extension
- Content: Valid JSON when opened

**Import:**
- Alert: "✅ Configuration imported successfully!"
- Fields: All populated with imported values
- Console: No errors

### ❌ ERROR INDICATORS

**QR Code:**
- Console: "QR generation error: ..."
- Visual: Red error box or "unavailable" message
- Network tab: qrcode.min.js failed to load

**.start Download:**
- Nothing happens when clicking button
- Console: "Download error: ..."
- No file in Downloads folder

**Import:**
- Alert: "❌ Error importing file: ..."
- Fields: Stay unchanged
- Console: JSON parse error

---

## Emergency Fixes

### If QR Still Doesn't Work

**Option 1: Use Alternative CDN**
```html
<script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
```

**Option 2: Download Library Locally**
1. Download from: https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js
2. Save as: `qrcode.min.js` in your project folder
3. Change script tag:
```html
<script src="qrcode.min.js"></script>
```

### If Download Still Doesn't Work

**Check Browser Permissions:**
1. Browser Settings → Privacy
2. Check: "Allow downloads"
3. Check: No download blocker extensions

**Try Manual Download:**
```javascript
// Add this to console
const data = {kw: "450"};
const json = JSON.stringify(data, null, 2);
console.log(json);
// Copy from console, paste into text file, save as .start
```

---

## Need More Help?

**Check Browser Console:**
- All errors show here
- Look for red text
- Shows exact line number of problem

**Check Network Tab:**
- Shows if scripts loaded
- Shows if requests failed
- Shows exact error codes

**Test in Different Browser:**
- Chrome
- Firefox
- Edge
- Safari (Mac)

If it works in one browser but not another, it's a browser-specific issue.

---

## Summary

**All fixes are now in place:**
1. ✅ QR code generation with proper error handling
2. ✅ .start file download with direct button handler
3. ✅ Import from .start file working
4. ✅ Print layout optimized (results + chart together)

**Test the app and check console messages - they'll tell you exactly what's happening!**
