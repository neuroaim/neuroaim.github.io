// ==================== 3D RENDERER ====================
// 3D projection, wall grid, and crosshair rendering

// ===== GLOBAL CANVAS DIMENSIONS =====
var canvasWidth = window.innerWidth;
var canvasHeight = window.innerHeight;

// Update dimensions on resize
window.addEventListener('resize', () => {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
});

// ===== 3D TRANSFORMATION FUNCTIONS =====

function rotate3D(x, y, z, yawPixels, pitchPixels) {
    // Use SENS_FACTOR from config.js (matches Valorant sensitivity)
    const yaw = (yawPixels || 0) * SENS_FACTOR;
    const pitch = (pitchPixels || 0) * SENS_FACTOR;
    
    // Y-axis rotation (Yaw)
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    
    // X-axis rotation (Pitch)
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    
    return { x: x1, y: y2, z: z2 };
}

function projectPoint(p) {
    if (p.z < 10) return null; // Near plane clipping
    
    const focalLength = (canvasWidth / 2) / 1.257;
    const scale = focalLength / (focalLength + p.z);
    
    return {
        x: p.x * scale + canvasWidth / 2,
        y: p.y * scale + canvasHeight / 2,
        scale: scale,
        visible: true
    };
}

function project3D(x, y, z, yawP, pitchP) {
    const p = rotate3D(x, y, z, yawP, pitchP);
    if (p.z < 10) return { x: 0, y: 0, scale: 0, visible: false };
    const proj = projectPoint(p);
    return { x: proj.x, y: proj.y, scale: proj.scale, visible: true };
}

// ===== POLYGON CLIPPING =====

function drawClippedPolygon(ctx, vertices, color, alpha) {
    if (vertices.length < 3) return;
    
    const outVerts = [];
    const minZ = 10;
    
    let p1 = vertices[vertices.length - 1];
    
    for (let i = 0; i < vertices.length; i++) {
        const p2 = vertices[i];
        const d1 = p1.z - minZ;
        const d2 = p2.z - minZ;
        
        if (d1 >= 0 && d2 >= 0) {
            outVerts.push(p2);
        } else if (d1 >= 0 && d2 < 0) {
            const t = d1 / (d1 - d2);
            outVerts.push({
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y),
                z: minZ
            });
        } else if (d1 < 0 && d2 >= 0) {
            const t = d1 / (d1 - d2);
            outVerts.push({
                x: p1.x + t * (p2.x - p1.x),
                y: p1.y + t * (p2.y - p1.y),
                z: minZ
            });
            outVerts.push(p2);
        }
        
        p1 = p2;
    }
    
    if (outVerts.length < 3) return;
    
    ctx.beginPath();
    const first = projectPoint(outVerts[0]);
    if (!first) return;
    ctx.moveTo(first.x, first.y);
    
    for (let i = 1; i < outVerts.length; i++) {
        const p = projectPoint(outVerts[i]);
        if (p) ctx.lineTo(p.x, p.y);
    }
    
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
}

function clipAndDrawLine(ctx, p1, p2) {
    const minZ = 10;
    if (p1.z < minZ && p2.z < minZ) return;
    
    if (p1.z >= minZ && p2.z >= minZ) {
        const s1 = projectPoint(p1);
        const s2 = projectPoint(p2);
        if (s1 && s2) {
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
        }
        return;
    }
    
    const near = (p1.z < minZ) ? p1 : p2;
    const far = (p1.z < minZ) ? p2 : p1;
    const t = (minZ - near.z) / (far.z - near.z);
    const clipX = near.x + (far.x - near.x) * t;
    const clipY = near.y + (far.y - near.y) * t;
    
    const sClip = projectPoint({ x: clipX, y: clipY, z: minZ });
    const sFar = projectPoint(far);
    
    if (sClip && sFar) {
        ctx.beginPath();
        ctx.moveTo(sClip.x, sClip.y);
        ctx.lineTo(sFar.x, sFar.y);
        ctx.stroke();
    }
}

// ===== SCENE RENDERING =====

function drawWallGrid(ctx, camX, camY, overrideColor, overrideBlur) {
    ctx.save();
    
    const color = overrideColor || 'rgba(0, 217, 255, 0.3)';
    const blur = overrideBlur || 0;
    
    const hw = WALL_WIDTH / 2;
    const hh = WALL_HEIGHT / 2;
    const zFront = WALL_DISTANCE;
    
    // LAYER 1: Infinite background grid
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.15;
    
    const zStart = -1000, zEnd = 8000, xRange = 4000;
    ctx.beginPath();
    
    // Vertical lines
    for (let x = -xRange; x <= xRange; x += 500) {
        clipAndDrawLine(ctx, rotate3D(x, hh + 200, zStart, camX, camY), rotate3D(x, hh + 200, zEnd, camX, camY));
        clipAndDrawLine(ctx, rotate3D(x, -hh - 200, zStart, camX, camY), rotate3D(x, -hh - 200, zEnd, camX, camY));
    }
    
    // Horizontal lines
    for (let z = 0; z <= zEnd; z += 500) {
        clipAndDrawLine(ctx, rotate3D(-xRange, hh + 200, z, camX, camY), rotate3D(xRange, hh + 200, z, camX, camY));
        clipAndDrawLine(ctx, rotate3D(-xRange, -hh - 200, z, camX, camY), rotate3D(xRange, -hh - 200, z, camX, camY));
    }
    ctx.stroke();
    
    // LAYER 2: Target wall (Solid + Grid)
    const tl = rotate3D(-hw, -hh, zFront, camX, camY);
    const tr = rotate3D(hw, -hh, zFront, camX, camY);
    const br = rotate3D(hw, hh, zFront, camX, camY);
    const bl = rotate3D(-hw, hh, zFront, camX, camY);
    
    // Solid background
    const wallVerts = [tl, tr, br, bl];
    drawClippedPolygon(ctx, wallVerts, '#050508', 1.0);
    drawClippedPolygon(ctx, wallVerts, color, 0.05);
    
    // Wall grid lines (30% opacity)
    ctx.beginPath();
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    
    for (let gx = -hw; gx <= hw; gx += 500) {
        const pTop = rotate3D(gx, -hh, zFront, camX, camY);
        const pBottom = rotate3D(gx, hh, zFront, camX, camY);
        clipAndDrawLine(ctx, pTop, pBottom);
    }
    
    for (let gy = -hh; gy <= hh; gy += 500) {
        const pLeft = rotate3D(-hw, gy, zFront, camX, camY);
        const pRight = rotate3D(hw, gy, zFront, camX, camY);
        clipAndDrawLine(ctx, pLeft, pRight);
    }
    ctx.stroke();
    
    // Wall border (glow)
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur > 0 ? blur + 20 : 15;
    
    clipAndDrawLine(ctx, tl, tr);
    clipAndDrawLine(ctx, tr, br);
    clipAndDrawLine(ctx, br, bl);
    clipAndDrawLine(ctx, bl, tl);
    
    ctx.restore();
}

// ===== CROSSHAIR RENDERING =====

function drawCrosshair(ctx, x, y, opacity) {
    const settings = Storage.getSettings();
    const style = settings.crosshair || 'cross';
    const scale = settings.crosshairScale || 1.0;
    
    // Use provided opacity or default to 1.0
    const alpha = (typeof opacity === 'number') ? opacity : 1.0;
    
    // Don't draw if fully transparent
    if (alpha <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00d9ff';
    ctx.shadowBlur = 8 * alpha;
    
    const size = 12 * scale;
    const gap = 4 * scale;
    
    switch (style) {
        case 'cross':
            ctx.beginPath();
            ctx.moveTo(x - size, y);
            ctx.lineTo(x - gap, y);
            ctx.moveTo(x + gap, y);
            ctx.lineTo(x + size, y);
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y - gap);
            ctx.moveTo(x, y + gap);
            ctx.lineTo(x, y + size);
            ctx.stroke();
            break;
            
        case 'dot':
            ctx.beginPath();
            ctx.arc(x, y, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
            break;
            
        case 'circle':
            ctx.beginPath();
            ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
            break;
            
        case 'crossdot':
            const smallSize = 8 * scale;
            ctx.beginPath();
            ctx.moveTo(x - smallSize, y);
            ctx.lineTo(x + smallSize, y);
            ctx.moveTo(x, y - smallSize);
            ctx.lineTo(x, y + smallSize);
            ctx.stroke();
            break;
    }
    
    ctx.restore();
}

// ===== GABOR PATCH RENDERING =====

function drawGaborPatch(ctx, x, y, size, isVertical, opacity) {
    ctx.save();
    const tempCanvas = document.createElement('canvas');
    const tempSize = Math.max(1, size * 3);
    tempCanvas.width = tempSize;
    tempCanvas.height = tempSize;
    const tempCtx = tempCanvas.getContext('2d');
    const cx = tempSize / 2;
    const cy = tempSize / 2;
    tempCtx.strokeStyle = 'rgb(180, 180, 180)';
    tempCtx.lineWidth = 3;
    const step = 6;
    tempCtx.beginPath();
    for (let i = -tempSize; i < tempSize; i += step) {
        if (isVertical) {
            tempCtx.moveTo(cx + i, 0);
            tempCtx.lineTo(cx + i, tempSize);
        } else {
            tempCtx.moveTo(0, cy + i);
            tempCtx.lineTo(tempSize, cy + i);
        }
    }
    tempCtx.stroke();
    tempCtx.globalCompositeOperation = 'destination-in';
    const gradient = tempCtx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    tempCtx.fillStyle = gradient;
    tempCtx.fillRect(0, 0, tempSize, tempSize);
    ctx.globalAlpha = Math.max(0.001, Math.min(1.0, opacity));
    ctx.drawImage(tempCanvas, x - size * 1.5, y - size * 1.5);
    ctx.restore();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        rotate3D, projectPoint, project3D,
        drawClippedPolygon, clipAndDrawLine,
        drawWallGrid, drawCrosshair, drawGaborPatch
    };
}