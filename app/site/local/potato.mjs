// potato-mode-v1 (max-optimization-vaim, 2026-11-15): "Potato" graphics for weak laptops
// (e.g. i5 8th gen + Intel UHD 620). Saved per PC as localStorage 'aim-potato-v1' = 'on' | 'off'.
//
// Rule: nothing that makes the picture blurrier. Resolution, render scale, pixel ratio,
// textures, texture filtering and mipmaps are NOT touched. Potato only removes work:
//  - sun shadows off (no 4096x4096 shadow map, no shadow lookup in every map pixel)
//  - anti-aliasing off (skips the framebuffer copy + 3 full-screen SMAA passes per frame)
//  - map lamps: 2 nearest point lights, no spot lights (was 10 + 4, or 4 + 1 on integrated GPUs)
// The page side (video-settings.js) also turns map culling on and the interface to Performance.
// Shadows, lights and anti-aliasing apply when the renderer is created: restart the game.
export const POTATO_KEY='aim-potato-v1';
export const POTATO_LIGHTS={point:2,spot:0};

export function readPotato(storage=globalThis.localStorage){
 try{return storage?.getItem(POTATO_KEY)==='on';}catch{return false;}
}

// Takes the game's GPU tier ({pointLights, spotLights, msaa, maxPixelRatio}) and returns the
// Potato version. maxPixelRatio stays as the game picked it (no lower resolution = no blur).
export function potatoTier(tier,on=readPotato()){
 if(!on||!tier)return tier;
 return {...tier,pointLights:Math.min(tier.pointLights,POTATO_LIGHTS.point),spotLights:Math.min(tier.spotLights,POTATO_LIGHTS.spot),msaa:false};
}
