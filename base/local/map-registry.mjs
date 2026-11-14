// Fetched on every page load. Map packages live outside the application image.
const response=await fetch('/local-api/maps',{cache:'no-store'});
if(!response.ok)throw Error('Không đọc được danh sách map local: HTTP '+response.status);
const catalog=await response.json();
export const maps=catalog.maps;
export const mapIds=maps.map(map=>map.id);
export const mapById=id=>maps.find(map=>map.id===id);
if(catalog.errors?.length)console.warn('Gói map chưa hợp lệ:',catalog.errors);
