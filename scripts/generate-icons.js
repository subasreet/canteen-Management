const fs = require('fs');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function generatePNG(width, height, isMaskable = false) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // Uncompressed scanlines
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * (isMaskable ? 0.46 : 0.44);
  const innerRadius = radius * 0.72;

  // Colors:
  // Brand Orange: #ff7200 -> R=255, G=114, B=0
  // Dark Background: #20242b -> R=32, G=36, B=43
  // White: #ffffff -> R=255, G=255, B=255
  // Light Amber: #ffaa00 -> R=255, G=170, B=0

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter byte = 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: Full bleed brand orange #ff7200 or rounded badge
      let r = 255, g = 114, b = 0, a = 255;

      if (!isMaskable) {
        // Rounded squircle / soft badge for 'any' icons
        const cornerR = width * 0.22;
        const inCornerX = x < cornerR ? cornerR - x : (x > width - cornerR ? x - (width - cornerR) : 0);
        const inCornerY = y < cornerR ? cornerR - y : (y > height - cornerR ? y - (height - cornerR) : 0);
        if (inCornerX > 0 && inCornerY > 0) {
          const cDist = Math.sqrt(inCornerX * inCornerX + inCornerY * inCornerY);
          if (cDist > cornerR) {
            a = 0; // transparent outside rounded corner
          }
        }
      }

      if (a > 0) {
        // Outer decorative circle (Dark Navy rim #20242b)
        if (dist <= radius && dist >= radius * 0.92) {
          r = 32; g = 36; b = 43; a = 255;
        } 
        // Inner badge circle (White plate #ffffff)
        else if (dist < radius * 0.92 && dist > innerRadius) {
          r = 255; g = 255; b = 255; a = 255;
        }
        // Center plate area (#20242b dark circle)
        else if (dist <= innerRadius) {
          r = 32; g = 36; b = 43; a = 255;

          // Fork & Spoon / Plate Icon Geometry
          // Left: Fork silhouette (x in [-radius*0.45, -radius*0.15])
          const fx = dx / innerRadius;
          const fy = dy / innerRadius;

          // Fork on left: fx around -0.3
          const isForkHandle = Math.abs(fx + 0.3) < 0.05 && fy > -0.1 && fy < 0.6;
          const isForkProngs = Math.abs(fx + 0.3) < 0.15 && fy <= -0.1 && fy > -0.6;
          const isForkSlits = (Math.abs(fx + 0.35) < 0.02 || Math.abs(fx + 0.25) < 0.02) && fy < -0.2 && fy > -0.55;

          // Knife/Spoon on right: fx around 0.3
          const isKnifeHandle = Math.abs(fx - 0.3) < 0.05 && fy > -0.1 && fy < 0.6;
          const isKnifeBlade = Math.abs(fx - 0.3) < 0.1 && fy <= -0.1 && fy > -0.6;

          // Center bowl/plate star sparkle
          const isStar = Math.abs(fx) < 0.06 && Math.abs(fy) < 0.06;

          if ((isForkHandle || (isForkProngs && !isForkSlits)) || (isKnifeHandle || isKnifeBlade) || isStar) {
            r = 255; g = 170; b = 0; // golden amber #ffaa00
          }
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressedData);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// Generate icons
fs.writeFileSync('pwa-192x192.png', generatePNG(192, 192, false));
fs.writeFileSync('pwa-512x512.png', generatePNG(512, 512, false));
fs.writeFileSync('pwa-maskable-512x512.png', generatePNG(512, 512, true));
fs.writeFileSync('apple-touch-icon.png', generatePNG(180, 180, false));

console.log('Successfully generated PWA PNG icons!');
