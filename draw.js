/*
 * From http://www.redblobgames.com/maps/mapgen2/
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

import * as util from './util';
import * as Colormap from './colormap';

const noiseSize = 100;
let noiseCanvas = null;
function makeNoise(randInt) {
    if (noiseCanvas === null) {
        noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = noiseSize;
        noiseCanvas.height = noiseSize;

        let ctx = noiseCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, noiseSize, noiseSize);
        const pixels = imageData.data;

        for (let y = 0, p = 0; y < noiseSize; y++) {
            for (let x = 0; x < noiseSize; x++) {
                let value = 128 + randInt(16) - 8;
                pixels[p++] = value;
                pixels[p++] = value;
                pixels[p++] = value;
                pixels[p++] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }
}


export function noisyFill(ctx, width, height, randInt) {
    makeNoise(randInt);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(noiseCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'hard-light';
    for (let y = 0; y < height; y += noiseSize) {
        for (let x = 0; x < width; x += noiseSize) {
            ctx.drawImage(noiseCanvas, x, y, noiseSize, noiseSize);
        }
    }
    ctx.restore();
};


const lightSize = 250;
const lightScaleZ = 15;
const lightVector = [-1, -1, 0];
let lightCanvas = null;

// quick & dirty light based on normal vector
function calculateLight(ax, ay, az,
                        bx, by, bz,
                        cx, cy, cz) {
    az *= lightScaleZ;
    bz *= lightScaleZ;
    cz *= lightScaleZ;
    let ux = bx - ax, uy = by - ay, uz = bz - az,
        vx = cx - ax, vy = cy - ay, vz = cz - az;
    // cross product (ugh I should have a lib for this)
    let nx = uy*vz - uz*vy,
        ny = uz*vx - ux*vz,
        nz = ux*vy - uy*vx;
    let length = -Math.sqrt(nx*nx + ny*ny + nz*nz);
    nx /= length;
    ny /= length;
    nz /= length;
    let dotProduct = nx * lightVector[0] + ny * lightVector[1] + nz * lightVector[2];
    let light = 0.5 + 10 * dotProduct;
    return util.clamp(light, 0, 1);
}

function makeLight(map) {
    if (lightCanvas === null) {
        lightCanvas = document.createElement('canvas');
        lightCanvas.width = lightSize;
        lightCanvas.height = lightSize;
    }
    let ctx = lightCanvas.getContext('2d');
    ctx.save();
    ctx.scale(lightSize/1000, lightSize/1000);
    ctx.fillStyle = "hsl(0,0%,50%)";
    ctx.fillRect(0, 0, 1000, 1000);
    let mesh = map.mesh;

    // Draw lighting on land; skip in the ocean
    let r_out = [];
    for (let t = 0; t < mesh.numSolidTriangles; t++) {
        mesh.r_around_t(t, r_out);
        if (r_out.some((r) => map.water_r[r])) { continue; }
        let ax = mesh.x_of_r(r_out[0]),
            ay = mesh.y_of_r(r_out[0]),
            az = map.elevation_r[r_out[0]],
            bx = mesh.x_of_r(r_out[1]),
            by = mesh.y_of_r(r_out[1]),
            bz = map.elevation_r[r_out[1]],
            cx = mesh.x_of_r(r_out[2]),
            cy = mesh.y_of_r(r_out[2]),
            cz = map.elevation_r[r_out[2]];
        let light = calculateLight(ax, ay, az*az, bx, by, bz*bz, cx, cy, cz*cz);
        light = util.lerp(light, map.elevation_t[t], 0.5);
        ctx.strokeStyle = ctx.fillStyle = `hsl(0,0%,${(light*100) | 0}%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
}
        
export function lighting(ctx, width, height, map) {
    makeLight(map);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(lightCanvas, 0, 0, width, height);
}


const islandShapeSize = 200;
let islandShapeCanvas = null;
function makeIsland(noise, params) {
    if (!islandShapeCanvas) {
        islandShapeCanvas = document.createElement('canvas');
        islandShapeCanvas.width = islandShapeSize;
        islandShapeCanvas.height = islandShapeSize;
    }
    
    let ctx = islandShapeCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, islandShapeSize, islandShapeSize);
    const pixels = imageData.data;

    for (let y = 0, p = 0; y < islandShapeSize; y++) {
        let ny = 2 * y/islandShapeSize - 1;
        for (let x = 0; x < islandShapeSize; x++) {
            let nx = 2 * x/islandShapeSize - 1;
            let distance = Math.max(Math.abs(nx), Math.abs(ny));
            let n = util.fbm_noise(noise, params.amplitudes, nx, ny);
            n = util.lerp(n, 0.5, params.round);
            if (n - (1.0 - params.inflate) * distance*distance < 0) {
                // water color uses OCEAN discrete color
                pixels[p++] = 0x44;
                pixels[p++] = 0x44;
                pixels[p++] = 0x7a;
            } else {
                // land color uses BEACH discrete color
                pixels[p++] = 0xa0;
                pixels[p++] = 0x90;
                pixels[p++] = 0x77;
            }
            pixels[p++] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

export function approximateIslandShape(ctx, width, height, noise, params) {
    makeIsland(noise, params);
    ctx.drawImage(islandShapeCanvas, 0, 0, width, height);
};


export function background(ctx, _colormap) {
    ctx.fillStyle = Colormap.discreteColors.OCEAN;
    ctx.fillRect(0, 0, 1000, 1000);
};


export function noisyRegions(ctx, map, colormap, noisyEdge) {
    let {mesh} = map;
    let s_out = [];

    for (let r = 0; r < mesh.numSolidRegions; r++) {
        mesh.s_around_r(r, s_out);
        let last_t = mesh.t_inner_s(s_out[0]);
        ctx.fillStyle = ctx.strokeStyle = colormap.biome(map, r);
        ctx.beginPath();
        ctx.moveTo(mesh.x_of_t(last_t), mesh.y_of_t(last_t));
        for (let s of s_out) {
            if (!noisyEdge || !colormap.side(map, s).noisy) {
                let first_t = mesh.t_outer_s(s);
                ctx.lineTo(mesh.x_of_t(first_t), mesh.y_of_t(first_t));
            } else {
                for (let p of map.lines_s[s]) {
                    ctx.lineTo(p[0], p[1]);
                }
            }
        }
        ctx.fill();
    }
};

/*
 * Helper function: how big is the region?
 *
 * Returns the minimum distance from the region center to a corner
 */
function region_radius(mesh, r) {
    let rx = mesh.x_of_r(r), ry = mesh.y_of_r(r);
    let min_distance_squared = Infinity;
    let t_out = [];
    mesh.t_around_r(r, t_out);
    for (let t of t_out) {
        let tx = mesh.x_of_t(t), ty = mesh.y_of_t(t);
        let dx = rx - tx, dy = ry - ty;
        let distance_squared = dx*dx + dy*dy;
        if (distance_squared < min_distance_squared) {
            min_distance_squared = distance_squared;
        }
    }
    return Math.sqrt(min_distance_squared);
}

/*
 * Draw a biome icon in each of the regions
 */
export function regionIcons(ctx, map, mapIconsConfig, randInt) {
    let {mesh} = map;
    for (let r = 0; r < mesh.numSolidRegions; r++) {
        if (mesh.is_boundary_r(r)) { continue; }
        let biome = map.biome_r[r];
        let radius = region_radius(mesh, r);
        let row = {
            OCEAN: 0, LAKE: 0,
            SHRUBLAND: 2,
            TEMPERATE_DESERT: 3, SUBTROPICAL_DESERT: 3,
            TROPICAL_RAIN_FOREST: 4, TROPICAL_SEASONAL_FOREST: 4,
            TEMPERATE_DECIDUOUS_FOREST: 5, TEMPERATE_RAIN_FOREST: 5,
            GRASSLAND: 6,
            MARSH: 7,
            TAIGA: 9,
        }[biome];
        // NOTE: mountains reflect elevation, but the biome
        // calculation reflects temperature, so if you set the biome
        // bias to be 'cold', you'll get more snow, but you shouldn't
        // get more mountains, so the mountains are calculated
        // separately from biomes
        if (row === 5 && mesh.y_of_r(r) < 300) { row = 9; }
        if (map.elevation_r[r] > 0.8) { row = 1; }
        if (row === undefined) { continue; }
        let col = 1 + randInt(5);
        ctx.drawImage(mapIconsConfig.image,
                      mapIconsConfig.left + col*100, mapIconsConfig.top + row*100,
                      100, 100,
                      mesh.x_of_r(r) - radius, mesh.y_of_r(r) - radius,
                      2*radius, 2*radius);
    }
};


/*
 * Drawing the region polygons leaves little gaps in HTML5 Canvas
 * so I need to draw edges to fill those gaps. Sometimes those edges
 * are simple straight lines but sometimes they're thick noisy lines
 * like coastlines and rivers.
 *
 * This step is rather slow so it's split up into phases.
 *
 * If 'filter' is defined, filter(side, style) should return true if
 * the edge is to be drawn. This is used by the rivers and coastline
 * drawing functions.
 */
export function noisyEdges(ctx, map, colormap, noisyEdge, phase /* 0-15 */, filter=null) {
    let {mesh} = map;
    let begin = (mesh.numSolidSides/16 * phase) | 0;
    let end = (mesh.numSolidSides/16 * (phase+1)) | 0;
    for (let s = begin; s < end; s++) {
        let style = colormap.side(map, s);
        if (filter && !filter(s, style)) { continue; }
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        let last_t = mesh.t_inner_s(s);
        ctx.beginPath();
        ctx.moveTo(mesh.x_of_t(last_t), mesh.y_of_t(last_t));
        if (!noisyEdge || !style.noisy) {
            let first_t = mesh.t_outer_s(s);
            ctx.lineTo(mesh.x_of_t(first_t), mesh.y_of_t(first_t));
        } else {
            for (let p of map.lines_s[s]) {
                ctx.lineTo(p[0], p[1]);
            }
        }
        ctx.stroke();
    }
};


export function vertices(ctx, map) {
    let {mesh} = map;
    ctx.fillStyle = "black";
    for (let r = 0; r < mesh.numSolidRegions; r++) {
        ctx.beginPath();
        ctx.arc(mesh.x_of_r(r), mesh.y_of_r(r), 2, 0, 2*Math.PI);
        ctx.fill();
    }
};


export function rivers(ctx, map, colormap, noisyEdge, fast) {
    if (!fast) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
    for (let phase = 0; phase < 16; phase++) {
        noisyEdges(ctx, map, colormap, noisyEdge, phase,
            (s, style) => colormap.draw_river_s(map, s));
    }
};


export function coastlines(ctx, map, colormap, noisyEdge) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let phase = 0; phase < 16; phase++) {
        noisyEdges(ctx, map, colormap, noisyEdge, phase,
            (s, style) => colormap.draw_coast_s(map, s));
    }
};
