var e={resolution:512,extent:.8,depth:.032,floor:.003,repose:.625,dynamicRepose:.48,rate:32,step:1/120,maxSteps:4,radius:.012,indentation:.02,particles:16384,maxContacts:8},t=()=>({from:{x:0,y:0},to:{x:0,y:0},velocity:{x:0,y:0},radius:e.radius,pressure:0,active:!1}),n=1e-4,r=1e-7,i=class{tracks=new Map;roundRobin=0;currentPressure=.7;position={x:0,y:0};radius=e.radius;begin(e,t,n,r=0){let i=this.bound(e),a=this.tracks.get(r),o=this.timestamp(a,n),s={...i,time:o};this.position=i,this.currentPressure=this.clampPressure(t),this.tracks.set(r,{held:!0,pressure:this.currentPressure,start:s,latest:s,latestTime:o,segments:a?.segments??[]})}move(e,t,n,r=0){let i=this.bound(e);this.position=i,this.currentPressure=this.clampPressure(t);let a=this.tracks.get(r);if(!a||!a.held)return;let o=this.timestamp(a,n);a.pressure=this.currentPressure,a.latestTime=o,a.latest={...i,time:o},this.subdivide(a)}end(e=0){let t=this.tracks.get(e);t&&(t.held=!1,this.flush(t),this.prune(e,t))}cancel(e){if(e===void 0){this.tracks.clear(),this.roundRobin=0;return}this.tracks.delete(e),this.roundRobin>=this.tracks.size&&(this.roundRobin=0)}clampPressure(e){return Math.max(.1,Math.min(1,e))}bound(t){let n=e.extent/2-.03;return{x:Math.max(-n,Math.min(n,t.x)),y:Math.max(-n,Math.min(n,t.y))}}timestamp(t,n){let r=t?.latestTime,i=(r??-e.step*1e3)+e.step*1e3,a=n!==void 0&&Number.isFinite(n)?n:i;return r===void 0?a:Math.max(r,a)}spacing(){return Math.max(e.extent/e.resolution*1.5,this.radius*.5)}makeStroke(e,t,r){let i=Math.max(n,(t.time-e.time)/1e3);return{from:{x:e.x,y:e.y},to:{x:t.x,y:t.y},velocity:{x:(t.x-e.x)/i,y:(t.y-e.y)/i},radius:this.radius,pressure:r,active:!0}}subdivide(e){let t=this.spacing(),n=Math.hypot(e.latest.x-e.start.x,e.latest.y-e.start.y);for(;n>=t;){let r=t/n,i={x:e.start.x+(e.latest.x-e.start.x)*r,y:e.start.y+(e.latest.y-e.start.y)*r,time:e.start.time+(e.latest.time-e.start.time)*r};e.segments.push(this.makeStroke(e.start,i,e.pressure)),e.start=i,n=Math.hypot(e.latest.x-e.start.x,e.latest.y-e.start.y)}}flush(e){Math.hypot(e.latest.x-e.start.x,e.latest.y-e.start.y)>r&&e.segments.push(this.makeStroke(e.start,e.latest,e.pressure)),e.start=e.latest}prune(e,t){!t.held&&t.segments.length===0&&this.tracks.delete(e)}drain(e){for(let e of this.tracks.values())e.held&&this.flush(e);let t=[...this.tracks.entries()];if(!t.length)return[];let n=[],r=0,i=this.roundRobin%t.length;for(;n.length<e&&r<t.length;){let[e,a]=t[i],o=a.segments.shift();o?(n.push(o),r=0,this.prune(e,a)):r++,i=(i+1)%t.length}return this.roundRobin=i,n}nextBatch(){return this.drain(e.maxContacts)}next(){return this.drain(1)[0]??{...t(),from:this.position,to:this.position,radius:this.radius,pressure:this.currentPressure}}get cursor(){return{...t(),from:this.position,to:this.position,radius:this.radius}}},a=-1,o=class{strokes=new i;showPointer=!1;pointers=new Set;controller=new AbortController;keyboardDrawing=!1;constructor(e,t,n){let{signal:r}=this.controller,i=e.canvas,o=e=>{let n=i.getBoundingClientRect();return t.screenToBed(e.clientX-n.left,e.clientY-n.top,n.width,n.height)},s=e=>e.pointerType===`pen`?e.pressure:.75;i.addEventListener(`pointerdown`,e=>{(e.pointerType!==`mouse`||e.button===0)&&(this.pointers.has(e.pointerId)||(this.pointers.add(e.pointerId),i.setPointerCapture(e.pointerId),i.focus({preventScroll:!0}),this.strokes.begin(o(e),s(e),e.timeStamp,e.pointerId),this.showPointer=!1))},{signal:r}),i.addEventListener(`pointermove`,e=>{let t=e.getCoalescedEvents?.()??[];for(let n of t.length?t:[e])this.strokes.move(o(n),s(n),n.timeStamp,e.pointerId)},{signal:r}),i.addEventListener(`pointerup`,e=>{this.pointers.has(e.pointerId)&&(this.strokes.move(o(e),s(e),e.timeStamp,e.pointerId),this.strokes.end(e.pointerId),this.pointers.delete(e.pointerId),i.hasPointerCapture(e.pointerId)&&i.releasePointerCapture(e.pointerId))},{signal:r});let c=e=>{this.pointers.delete(e),this.strokes.cancel(e)},l=()=>{this.pointers.clear(),this.keyboardDrawing=!1,this.strokes.cancel()};i.addEventListener(`pointercancel`,e=>c(e.pointerId),{signal:r}),i.addEventListener(`lostpointercapture`,e=>{this.pointers.has(e.pointerId)&&c(e.pointerId)},{signal:r}),window.addEventListener(`blur`,l,{signal:r}),document.addEventListener(`visibilitychange`,()=>{document.hidden&&l()},{signal:r}),e.radius.addEventListener(`input`,()=>{this.strokes.radius=Number(e.radius.value)/1e3,this.showPointer=!0},{signal:r}),e.reset.addEventListener(`click`,()=>{l(),n()},{signal:r}),i.addEventListener(`keydown`,t=>{t.key.toLowerCase()===`r`&&(l(),n()),t.code===`Space`&&(t.preventDefault(),this.keyboardDrawing||=(this.strokes.begin(this.strokes.position,.75,t.timeStamp,a),!0));let r={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[t.key];r&&(t.preventDefault(),this.showPointer=!0,this.strokes.move({x:this.strokes.position.x+r[0]*.003,y:this.strokes.position.y+r[1]*.003},.75,t.timeStamp,a)),(t.key===`[`||t.key===`]`)&&(e.radius.value=String(Number(e.radius.value)+(t.key===`[`?-1:1)),this.strokes.radius=Number(e.radius.value)/1e3,this.showPointer=!0)},{signal:r}),i.addEventListener(`keyup`,e=>{e.code===`Space`&&(this.strokes.end(a),this.keyboardDrawing=!1)},{signal:r})}dispose(){this.controller.abort(),this.strokes.cancel()}};async function s(e,t){if(!navigator.gpu)throw Error(`WebGPU is unavailable. A secure context and supported GPU/browser are required.`);t.stage(`Requesting GPU`);let n=await navigator.gpu.requestAdapter({powerPreference:`high-performance`});if(!n)throw Error(`No hardware WebGPU adapter is available.`);if(n.info.isFallbackAdapter)throw Error(`A hardware WebGPU adapter is required, not a software fallback.`);t.setAdapter([n.info.vendor,n.info.architecture,n.info.description].filter(Boolean).join(` / `));let r=await n.requestDevice({label:`Sandboard GPU`}),i=!1;r.lost.then(e=>{i||t.fail(Error(`GPU device lost (${e.reason}): ${e.message}`))}),r.addEventListener(`uncapturederror`,e=>t.fail(Error(`Uncaptured GPU error: ${e.error.message}`)));let a=e.getContext(`webgpu`);try{if(t.assertHealthy(),!a)throw Error(`The browser could not create a WebGPU canvas context.`);let e=navigator.gpu.getPreferredCanvasFormat();return a.configure({device:r,format:e,alphaMode:`opaque`}),{device:r,context:a,format:e,dispose:()=>{i=!0,a.unconfigure(),r.destroy()}}}catch(e){throw i=!0,r.destroy(),e}}function c(e){if(!(e.maxTouchPoints>0))return!1;let t=/Android|iPhone|iPad|iPod|Mobile/i.test(e.userAgent),n=e.coarsePointer&&Math.min(e.width,e.height)<=1024;return t||n}function l(){return c({maxTouchPoints:navigator.maxTouchPoints,coarsePointer:window.matchMedia?.(`(pointer: coarse)`).matches??!1,userAgent:navigator.userAgent,width:window.innerWidth,height:window.innerHeight})}function u(e,t,n){if(e<=0||t<=0||!Number.isFinite(e+t))return null;let r=Math.min(Number.isFinite(n)&&n>0?n:1,1.7,Math.sqrt(4e6/(e*t)));return{width:Math.max(1,Math.floor(e*r)),height:Math.max(1,Math.floor(t*r)),dpr:r}}async function d(e,t,n){let r=e.createShaderModule({label:t,code:n}),i=(await r.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(i.length)throw Error(`${t}: ${i.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);return r}function f(e){let t=Math.hypot(...e);return e.map(e=>e/t)}var p=class{eye=[0,.52,.26];forward=f([0,e.depth-this.eye[1],-this.eye[2]]);right=[1,0,0];up=[0,-this.forward[2],this.forward[1]];distance=Math.hypot(this.eye[1]-e.depth,this.eye[2]);aspect=1;get tanHalfFov(){return .22/this.distance/Math.max(1,this.aspect)}screenToBed(t,n,r,i){let a=(2*t/r-1)*this.tanHalfFov*this.aspect,o=(1-2*n/i)*this.tanHalfFov,s=this.forward.map((e,t)=>e+a*this.right[t]+o*this.up[t]),c=(e.depth-this.eye[1])/s[1];return{x:this.eye[0]+s[0]*c,y:this.eye[2]+s[2]*c}}},m=Math.cos(-.8),h=.65,g=Math.sin(-.8),_=512,v=.82,y=`
struct ShadowView {
  projected: vec4f,
  motion: vec4f,
}
@group(0) @binding(0) var<uniform> view: ShadowView;
@group(0) @binding(1) var colorSampler: sampler;
@group(0) @binding(2) var colorTexture: texture_2d<f32>;
struct VertexInput {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
}
struct VertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
}
@vertex fn vertex(input: VertexInput) -> VertexOutput {
  let height = clamp(input.position.y, 0.0, 1.0);
  let bend = height * height;
  let phase = view.motion.x;
  let swayX = (sin(phase * 0.73) * 0.045 + sin(phase * 0.31 + 1.6) * 0.018) * bend;
  let swayZ = (cos(phase * 0.61 + 0.7) * 0.034 + sin(phase * 0.27) * 0.014) * bend;
  let twist = sin(phase * 0.43 + height * 2.2) * 0.022 * bend;
  let cosine = cos(twist);
  let sine = sin(twist);
  let rotatedXZ = vec2f(input.position.x * cosine - input.position.z * sine,
    input.position.x * sine + input.position.z * cosine);
  let position = vec3f(rotatedXZ.x + swayX, input.position.y, rotatedXZ.y + swayZ);
  let projected = position.xz - vec2f(${m.toFixed(9)}, ${g.toFixed(9)}) * (position.y / ${h.toFixed(9)});
  let normalized = (projected - view.projected.xy) / view.projected.zw;
  var output: VertexOutput;
  output.clip = vec4f(normalized.x, -normalized.y, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let texel = textureSample(colorTexture, colorSampler, input.uv);
  let alpha = smoothstep(0.10, 0.55, texel.a);
  if (alpha <= 0.002) { discard; }
  return vec4f(alpha, alpha, alpha, alpha);
}
`,b=`
struct StabilizeView { settings: vec4f }
@group(0) @binding(0) var maskSampler: sampler;
@group(0) @binding(1) var rawMask: texture_2d<f32>;
@group(0) @binding(2) var historyMask: texture_2d<f32>;
@group(0) @binding(3) var<uniform> stabilize: StabilizeView;
struct VertexOutput { @builtin(position) clip: vec4f, @location(0) uv: vec2f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let clip = positions[index];
  var output: VertexOutput;
  output.clip = vec4f(clip, 0.0, 1.0);
  output.uv = clip * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}
fn filteredRaw(uv: vec2f) -> f32 {
  let texel = stabilize.settings.xy;
  let center = textureSampleLevel(rawMask, maskSampler, uv, 0.0).x * 0.36;
  let cardinals = (
    textureSampleLevel(rawMask, maskSampler, uv + vec2f(texel.x, 0.0), 0.0).x +
    textureSampleLevel(rawMask, maskSampler, uv - vec2f(texel.x, 0.0), 0.0).x +
    textureSampleLevel(rawMask, maskSampler, uv + vec2f(0.0, texel.y), 0.0).x +
    textureSampleLevel(rawMask, maskSampler, uv - vec2f(0.0, texel.y), 0.0).x
  ) * 0.12;
  let diagonals = (
    textureSampleLevel(rawMask, maskSampler, uv + texel, 0.0).x +
    textureSampleLevel(rawMask, maskSampler, uv + vec2f(texel.x, -texel.y), 0.0).x +
    textureSampleLevel(rawMask, maskSampler, uv - vec2f(texel.x, -texel.y), 0.0).x +
    textureSampleLevel(rawMask, maskSampler, uv - texel, 0.0).x
  ) * 0.04;
  return center + cardinals + diagonals;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let raw = filteredRaw(input.uv);
  let history = textureSampleLevel(historyMask, maskSampler, input.uv, 0.0).x;
  let historyEnabled = stabilize.settings.z;
  let difference = abs(raw - history);
  let alpha = mix(1.0, mix(0.16, 0.46, smoothstep(0.025, 0.22, difference)), historyEnabled);
  let stable = mix(history, raw, alpha);
  return vec4f(stable, stable, stable, stable);
}
`;function x(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}function S(e,t){let n=new Float32Array(16);for(let r=0;r<4;r++)for(let i=0;i<4;i++){let a=0;for(let n=0;n<4;n++)a+=e[n*4+i]*t[r*4+n];n[r*4+i]=a}return n}function C(e){if(e.matrix?.length===16)return new Float32Array(e.matrix);let t=x();return e.scale?.length===3&&(t[0]=e.scale[0],t[5]=e.scale[1],t[10]=e.scale[2]),e.translation?.length===3&&(t[12]=e.translation[0],t[13]=e.translation[1],t[14]=e.translation[2]),t}function w(e,t,n,r){return[e[0]*t+e[4]*n+e[8]*r+e[12],e[1]*t+e[5]*n+e[9]*r+e[13],e[2]*t+e[6]*n+e[10]*r+e[14]]}function T(e){if(e===`SCALAR`)return 1;if(e===`VEC2`)return 2;if(e===`VEC3`)return 3;if(e===`VEC4`)return 4;throw Error(`Unsupported glTF accessor type: ${e}`)}function E(e){if(e===5126||e===5125)return 4;if(e===5123)return 2;throw Error(`Unsupported glTF component type: ${e}`)}function D(e,t,n){let r=e.accessors[n],i=e.bufferViews[r.bufferView],a=T(r.type),o=E(r.componentType),s=i.byteStride??a*o,c=(i.byteOffset??0)+(r.byteOffset??0),l=new DataView(t),u=new Float32Array(r.count*a);for(let e=0;e<r.count;e++)for(let t=0;t<a;t++){let n=c+e*s+t*o,i=r.componentType===5126?l.getFloat32(n,!0):r.componentType===5125?l.getUint32(n,!0):l.getUint16(n,!0);u[e*a+t]=i}return u}function O(e,t,n){let r=D(e,t,n),i=new Uint32Array(r.length);for(let e=0;e<r.length;e++)i[e]=r[e];return i}function k(e){let t=new DataView(e);if(t.getUint32(0,!0)!==1179937895||t.getUint32(4,!0)!==2)throw Error(`Coconut tree is not a valid glTF 2.0 binary.`);let n=12,r,i;for(;n<e.byteLength;){let a=t.getUint32(n,!0),o=t.getUint32(n+4,!0);n+=8;let s=e.slice(n,n+a);n+=a,o===1313821514&&(r=JSON.parse(new TextDecoder().decode(s))),o===5130562&&(i=s)}if(!r||!i)throw Error(`Coconut tree glTF is missing JSON or binary data.`);return{gltf:r,binary:i}}async function A(){let e=await fetch(`/scene_assets/coconut_tree.glb`);if(!e.ok)throw Error(`Unable to load coconut tree (${e.status}).`);let{gltf:t,binary:n}=k(await e.arrayBuffer()),r=t.nodes.map(()=>x()),i=(e,n)=>{let a=S(n,C(t.nodes[e]));r[e]=a;for(let n of t.nodes[e].children??[])i(n,a)};for(let e of t.scenes[t.scene].nodes)i(e,x());let a=[],o=1/0,s=1/0,c=1/0,l=-1/0,u=-1/0,d=-1/0;for(let[e,i]of t.nodes.entries()){if(i.mesh===void 0)continue;let f=t.meshes[i.mesh].primitives[0],p=D(t,n,f.attributes.POSITION),m=D(t,n,f.attributes.TEXCOORD_0),h=new Float32Array(p.length);for(let t=0;t<p.length;t+=3){let n=w(r[e],p[t],p[t+1],p[t+2]);h[t]=n[0],h[t+1]=n[1],h[t+2]=n[2],o=Math.min(o,n[0]),s=Math.min(s,n[1]),c=Math.min(c,n[2]),l=Math.max(l,n[0]),u=Math.max(u,n[1]),d=Math.max(d,n[2])}a.push({positions:h,texcoords:m,indices:O(t,n,f.indices)})}let f=Math.max(u-s,1e-6),p=(o+l)*.5,_=(c+d)*.5,v=a.map(e=>{let t=new Float32Array(e.positions.length);for(let n=0;n<e.positions.length;n+=3)t[n]=(e.positions[n]-p)/f,t[n+1]=(e.positions[n+1]-s)/f,t[n+2]=(e.positions[n+2]-_)/f;return{...e,positions:t}}),y=1/0,b=1/0,T=-1/0,E=-1/0;for(let e of v)for(let t=0;t<e.positions.length;t+=3){let n=e.positions[t],r=e.positions[t+1],i=e.positions[t+2],a=n-m*r/h,o=i-g*r/h;y=Math.min(y,a),T=Math.max(T,a),b=Math.min(b,o),E=Math.max(E,o)}let A={x:(y+T)*.5,y:(b+E)*.5},j={x:(T-y)*.58,y:(E-b)*.58},M=t.images[0],N=t.bufferViews[M.bufferView],P=N.byteOffset??0;return{meshes:v,image:new Blob([n.slice(P,P+N.byteLength)],{type:M.mimeType}),projectedCenter:A,projectedHalfSize:j}}function j(e){let t=e.positions.length/3,n=new Float32Array(t*5);for(let r=0;r<t;r++)n[r*5]=e.positions[r*3],n[r*5+1]=e.positions[r*3+1],n[r*5+2]=e.positions[r*3+2],n[r*5+3]=e.texcoords[r*2],n[r*5+4]=e.texcoords[r*2+1];return n}function M(e,t,n,r,i){let a=r?{x:.83,y:.17}:{x:.855,y:.185},o=e(t*a.x,n*a.y),s=e(t*(a.x-(r?.27:.22)),n*a.y),c=e(t*(a.x+(r?.27:.22)),n*a.y),l=Math.abs(c.x-s.x)*.5,u=l/Math.max(i,.25);return{centerX:o.x,centerZ:o.y,halfWidth:l,halfHeight:u}}var N=class{sampler;texture;device;shadowUniform;stabilizeUniform;shadowData=new Float32Array(8);stabilizeData=new Float32Array(4);shadowPipeline;stabilizePipeline;shadowGroup;stabilizeGroup;geometries=[];colorTexture;rawTexture;historyTexture;projectedCenter={x:0,y:0};projectedHalfSize={x:1,y:1};placement={centerX:.18,centerZ:-.1,halfWidth:.11,halfHeight:.11};hasHistory=!1;mobile=!1;constructor(e,t=!1){this.device=e,this.mobile=t,this.shadowUniform=e.createBuffer({label:`Coconut shadow view`,size:this.shadowData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.stabilizeUniform=e.createBuffer({label:`Coconut shadow stabilization`,size:this.stabilizeData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.texture=e.createTexture({label:`Coconut tree shadow`,size:[_,_],format:`rgba8unorm`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.rawTexture=e.createTexture({label:`Coconut tree shadow raw`,size:[_,_],format:`rgba8unorm`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.historyTexture=e.createTexture({label:`Coconut tree shadow history`,size:[_,_],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.sampler=e.createSampler({label:`Coconut tree shadow sampler`,magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`})}async initialize(){if(typeof window>`u`||typeof createImageBitmap!=`function`)return;let e=await A();this.projectedCenter=e.projectedCenter,this.projectedHalfSize=e.projectedHalfSize;for(let t of e.meshes){let e=j(t),n=this.device.createBuffer({label:`Coconut shadow vertices`,size:e.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),r=this.device.createBuffer({label:`Coconut shadow indices`,size:t.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(n,0,e),this.device.queue.writeBuffer(r,0,t.indices),this.geometries.push({vertex:n,index:r,indexCount:t.indices.length})}let t=await createImageBitmap(e.image);this.colorTexture=this.device.createTexture({label:`Coconut alpha texture`,size:[t.width,t.height],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}),this.device.queue.copyExternalImageToTexture({source:t},{texture:this.colorTexture},[t.width,t.height]),t.close();let n=this.device.createSampler({label:`Coconut alpha sampler`,magFilter:`linear`,minFilter:`linear`,addressModeU:`repeat`,addressModeV:`repeat`}),r=this.device.createShaderModule({label:`Coconut shadow WGSL`,code:y});this.shadowPipeline=await this.device.createRenderPipelineAsync({label:`Coconut shadow mask`,layout:`auto`,vertex:{module:r,entryPoint:`vertex`,buffers:[{arrayStride:20,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x2`}]}]},fragment:{module:r,entryPoint:`fragment`,targets:[{format:`rgba8unorm`,blend:{color:{operation:`max`,srcFactor:`one`,dstFactor:`one`},alpha:{operation:`max`,srcFactor:`one`,dstFactor:`one`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),this.shadowGroup=this.device.createBindGroup({layout:this.shadowPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.shadowUniform}},{binding:1,resource:n},{binding:2,resource:this.colorTexture.createView()}]});let i=this.device.createShaderModule({label:`Coconut shadow stabilize WGSL`,code:b});this.stabilizePipeline=await this.device.createRenderPipelineAsync({label:`Coconut shadow stabilize`,layout:`auto`,vertex:{module:i,entryPoint:`vertex`},fragment:{module:i,entryPoint:`fragment`,targets:[{format:`rgba8unorm`}]},primitive:{topology:`triangle-list`}}),this.stabilizeGroup=this.device.createBindGroup({layout:this.stabilizePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.rawTexture.createView()},{binding:2,resource:this.historyTexture.createView()},{binding:3,resource:{buffer:this.stabilizeUniform}}]})}resize(e,t,n){let r=this.projectedHalfSize.x/Math.max(this.projectedHalfSize.y,1e-4);this.placement=M(n,e,t,this.mobile,r)}encode(e,t){if(!this.shadowPipeline||!this.stabilizePipeline)return;this.shadowData.set([this.projectedCenter.x,this.projectedCenter.y,this.projectedHalfSize.x,this.projectedHalfSize.y,t*.001,0,0,0]),this.stabilizeData.set([1/_,1/_,+!!this.hasHistory,0]),this.device.queue.writeBuffer(this.shadowUniform,0,this.shadowData),this.device.queue.writeBuffer(this.stabilizeUniform,0,this.stabilizeData);let n=e.beginRenderPass({label:`Coconut tree shadow raw`,colorAttachments:[{view:this.rawTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.shadowPipeline),n.setBindGroup(0,this.shadowGroup);for(let e of this.geometries)n.setVertexBuffer(0,e.vertex),n.setIndexBuffer(e.index,`uint32`),n.drawIndexed(e.indexCount);n.end();let r=e.beginRenderPass({label:`Coconut tree shadow stabilize`,colorAttachments:[{view:this.texture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});r.setPipeline(this.stabilizePipeline),r.setBindGroup(0,this.stabilizeGroup),r.draw(3),r.end(),e.copyTextureToTexture({texture:this.texture},{texture:this.historyTexture},{width:_,height:_}),this.hasHistory=!0}get centerX(){return this.placement.centerX}get centerZ(){return this.placement.centerZ}get halfWidth(){return this.placement.halfWidth}get halfHeight(){return this.placement.halfHeight}get opacity(){return v}dispose(){for(let e of this.geometries)e.vertex.destroy(),e.index.destroy();this.colorTexture?.destroy(),this.rawTexture.destroy(),this.historyTexture.destroy(),this.texture.destroy(),this.shadowUniform.destroy(),this.stabilizeUniform.destroy()}},P=`
struct View { eye: vec4f, forward: vec4f, right: vec4f, up: vec4f, light: vec4f, grid: vec4f, pointer: vec4f }
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage, read> bed: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> lighting: array<vec4f>;
fn heightAt(cell: vec2i) -> f32 {
  let bounded = vec2u(clamp(cell, vec2i(0), vec2i(i32(view.grid.x) - 1)));
  return bed[bounded.y * u32(view.grid.x) + bounded.x].x;
}
fn sampleHeight(coordinate: vec2f) -> f32 {
  let cell = vec2i(floor(coordinate));
  let blend = fract(coordinate);
  return mix(mix(heightAt(cell), heightAt(cell + vec2i(1, 0)), blend.x),
    mix(heightAt(cell + vec2i(0, 1)), heightAt(cell + vec2i(1, 1)), blend.x), blend.y);
}
@compute @workgroup_size(8, 8)
fn illuminate(@builtin(global_invocation_id) invocation: vec3u) {
  if (any(invocation.xy >= vec2u(u32(view.grid.x)))) { return; }
  let cell = vec2i(invocation.xy);
  let coordinate = vec2f(cell);
  let spacing = view.grid.y / view.grid.x;
  let height = heightAt(cell);
  let gradient = vec2f(heightAt(cell + vec2i(1, 0)) - heightAt(cell - vec2i(1, 0)),
    heightAt(cell + vec2i(0, 1)) - heightAt(cell - vec2i(0, 1))) / (2.0 * spacing);
  let light = normalize(view.light.xyz);
  var visibility = 1.0;
  for (var sampleIndex = 1; sampleIndex <= 14; sampleIndex++) {
    let distance = spacing * (0.8 * f32(sampleIndex) + 0.38 * f32(sampleIndex * sampleIndex));
    let probe = coordinate + light.xz * distance / spacing;
    if (any(probe < vec2f(0.0)) || any(probe > vec2f(view.grid.x - 1.0))) { break; }
    let blocker = sampleHeight(probe) - height - light.y * distance;
    visibility = min(visibility, 1.0 - smoothstep(-0.0002 - distance * 0.035, 0.0004 + distance * 0.045, blocker));
  }
  let directions = array<vec2f, 8>(vec2f(1.0, 0.0), vec2f(-1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, -1.0),
    vec2f(0.70710678, 0.70710678), vec2f(-0.70710678, -0.70710678),
    vec2f(0.70710678, -0.70710678), vec2f(-0.70710678, 0.70710678));
  let radii = array<f32, 6>(1.0, 2.0, 4.0, 8.0, 16.0, 32.0);
  var obscured = 0.0;
  for (var axis = 0u; axis < 8u; axis++) {
    let direction = directions[axis];
    let tangentAngle = atan(dot(gradient, direction));
    var horizon = 0.0;
    for (var sampleIndex = 0u; sampleIndex < 6u; sampleIndex++) {
      let distance = radii[sampleIndex] * spacing;
      let probe = coordinate + direction * radii[sampleIndex];
      if (any(probe < vec2f(0.0)) || any(probe > vec2f(view.grid.x - 1.0))) { break; }
      let angle = atan((sampleHeight(probe) - height - 0.00008) / distance);
      horizon = max(horizon, angle - tangentAngle);
    }
    let blocked = sin(min(horizon, 1.57079633));
    obscured += blocked * blocked;
  }
  lighting[invocation.y * u32(view.grid.x) + invocation.x] = vec4f(visibility, clamp(1.0 - obscured / 8.0, 0.0, 1.0), 0.0, 0.0);
}
`,F=class{buffer;pipeline;groups=[];revision=-1;angle=NaN;device;solver;uniform;constructor(e,t,n){this.device=e,this.solver=t,this.uniform=n,this.buffer=e.createBuffer({label:`Bed-space illumination`,size:t.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})}async initialize(){let e=await d(this.device,`Bed horizon lighting WGSL`,P);this.pipeline=await this.device.createComputePipelineAsync({layout:`auto`,compute:{module:e,entryPoint:`illuminate`}}),this.groups=this.solver.buffers.map(e=>this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:e}},{binding:2,resource:{buffer:this.buffer}}]}))}encode(e,t){if(this.revision===this.solver.revision&&this.angle===t)return;let n=e.beginComputePass({label:`Bed horizon lighting`});n.setPipeline(this.pipeline),n.setBindGroup(0,this.groups[this.solver.stateIndex]),n.dispatchWorkgroups(Math.ceil(this.solver.resolution/8),Math.ceil(this.solver.resolution/8)),n.end(),this.revision=this.solver.revision,this.angle=t}dispose(){this.buffer.destroy()}},I=`
struct PostView { texel: vec4f }
@group(0) @binding(0) var postSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> postView: PostView;
struct VertexOutput { @builtin(position) clip: vec4f, @location(0) uv: vec2f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let clip = positions[index];
  var output: VertexOutput;
  output.clip = vec4f(clip, 0.0, 1.0);
  output.uv = clip * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}
fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}
fn bright(color: vec3f) -> vec3f {
  let threshold = 0.925;
  let knee = 0.035;
  let luma = luminance(color);
  let weight = smoothstep(threshold - knee, threshold + knee, luma);
  return color * max((luma - threshold) / max(luma, 0.0001), 0.0) * weight;
}
fn filmicGrade(color: vec3f, uv: vec2f) -> vec3f {
  let sourceLuma = max(luminance(color), 0.0001);
  let contrastCurve = sourceLuma * sourceLuma * (3.0 - 2.0 * sourceLuma);
  let gradedLuma = mix(sourceLuma, contrastCurve, 0.24);
  var graded = color * (gradedLuma / sourceLuma);

  let gradedGray = vec3f(luminance(graded));
  graded = mix(gradedGray, graded, 0.95);

  let mood = smoothstep(0.12, 0.86, gradedLuma);
  let shadowTone = vec3f(0.965, 0.985, 1.025);
  let highlightTone = vec3f(1.035, 1.005, 0.955);
  graded *= mix(shadowTone, highlightTone, mood);

  let centered = uv * 2.0 - 1.0;
  let vignette = 1.0 - smoothstep(0.36, 1.18, dot(centered, centered)) * 0.10;
  graded *= vignette;
  return clamp(graded, vec3f(0.0), vec3f(1.0));
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let texel = postView.texel.xy;
  let base = textureSample(sourceTexture, postSampler, input.uv).rgb;
  let offsets = array<vec2f, 16>(
    vec2f(1.3, 0.0), vec2f(-1.3, 0.0), vec2f(0.0, 1.3), vec2f(0.0, -1.3),
    vec2f(1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(-1.0, -1.0),
    vec2f(3.1, 0.0), vec2f(-3.1, 0.0), vec2f(0.0, 3.1), vec2f(0.0, -3.1),
    vec2f(5.4, 0.0), vec2f(-5.4, 0.0), vec2f(0.0, 5.4), vec2f(0.0, -5.4)
  );
  let weights = array<f32, 16>(0.13, 0.13, 0.13, 0.13, 0.105, 0.105, 0.105, 0.105, 0.065, 0.065, 0.065, 0.065, 0.028, 0.028, 0.028, 0.028);
  var bloom = vec3f(0.0);
  for (var index = 0u; index < 16u; index++) {
    bloom += bright(textureSample(sourceTexture, postSampler, input.uv + offsets[index] * texel).rgb) * weights[index];
  }
  let bloomed = clamp(base + bloom * 2.15, vec3f(0.0), vec3f(1.0));
  let color = filmicGrade(bloomed, input.uv);
  return vec4f(color, 1.0);
}
`,L=class{uniform;sampler;module;pipeline;bindGroup;scene;sceneView;width=0;height=0;device;sourceFormat;targetFormat;constructor(e,t,n){this.device=e,this.sourceFormat=t,this.targetFormat=n,this.uniform=e.createBuffer({label:`Filmic post uniform`,size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.sampler=e.createSampler({label:`Filmic post sampler`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),this.module=e.createShaderModule({label:`Filmic post WGSL`,code:I})}async initialize(){this.pipeline=await this.device.createRenderPipelineAsync({label:`Filmic post process`,layout:`auto`,vertex:{module:this.module,entryPoint:`vertex`},fragment:{module:this.module,entryPoint:`fragment`,targets:[{format:this.targetFormat}]},primitive:{topology:`triangle-list`}})}resize(e,t){(e!==this.width||t!==this.height)&&(this.scene?.destroy(),this.width=e,this.height=t,this.scene=this.device.createTexture({label:`Scene color`,size:[e,t],format:this.sourceFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.sceneView=this.scene.createView(),this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.sceneView},{binding:2,resource:{buffer:this.uniform}}]}),this.device.queue.writeBuffer(this.uniform,0,new Float32Array([1/e,1/t,0,0])))}get target(){if(!this.sceneView)throw Error(`Post process textures are not initialized.`);return this.sceneView}encode(e,t){let n=e.beginRenderPass({label:`Filmic composite`,colorAttachments:[{view:t,clearValue:{r:.55,g:.44,b:.29,a:1},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.pipeline),n.setBindGroup(0,this.bindGroup),n.draw(3),n.end()}dispose(){this.scene?.destroy(),this.uniform.destroy()}},R=`
struct View {
  eye: vec4f,
  forward: vec4f,
  right: vec4f,
  up: vec4f,
  light: vec4f,
  grid: vec4f,
  pointer: vec4f,
  shadowBounds: vec4f,
  shadowControl: vec4f,
}
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<storage, read> bed: array<vec4f>;
struct Grain { position: vec4f, velocity: vec4f }
@group(0) @binding(2) var<storage, read> grains: array<Grain>;
@group(0) @binding(3) var<storage, read> lighting: array<vec4f>;
@group(0) @binding(4) var shadowSampler: sampler;
@group(0) @binding(5) var shadowTexture: texture_2d<f32>;
fn lightAt(cell: vec2i) -> vec2f {
  let bounded = vec2u(clamp(cell, vec2i(0), vec2i(i32(view.grid.x) - 1)));
  return lighting[bounded.y * u32(view.grid.x) + bounded.x].xy;
}
fn illuminationAt(position: vec2f) -> vec2f {
  let coordinate = (position / view.grid.y + 0.5) * view.grid.x - 0.5;
  let cell = vec2i(floor(coordinate));
  let blend = fract(coordinate);
  return mix(mix(lightAt(cell), lightAt(cell + vec2i(1, 0)), blend.x),
    mix(lightAt(cell + vec2i(0, 1)), lightAt(cell + vec2i(1, 1)), blend.x), blend.y);
}
fn cellAt(cell: vec2i) -> vec4f {
  let bounded = clamp(cell, vec2i(0), vec2i(i32(view.grid.x) - 1));
  return bed[u32(bounded.y) * u32(view.grid.x) + u32(bounded.x)];
}
fn stateAt(position: vec2f) -> vec4f {
  let coordinate = (position / view.grid.y + 0.5) * view.grid.x - 0.5;
  let cell = vec2i(floor(coordinate));
  let blend = fract(coordinate);
  return mix(mix(cellAt(cell), cellAt(cell + vec2i(1, 0)), blend.x),
    mix(cellAt(cell + vec2i(0, 1)), cellAt(cell + vec2i(1, 1)), blend.x), blend.y);
}
fn project(position: vec3f) -> vec4f {
  let relative = position - view.eye.xyz;
  let depth = dot(relative, view.forward.xyz);
  return vec4f(dot(relative, view.right.xyz) / (view.eye.w * view.forward.w),
    dot(relative, view.up.xyz) / view.eye.w, depth * 1.001001 - 0.01001001, depth);
}
struct VertexOutput { @builtin(position) clip: vec4f, @location(0) world: vec3f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
  let cell = vec2u(index % u32(view.grid.x), index / u32(view.grid.x));
  let position = (vec2f(cell) + 0.5) / view.grid.x * view.grid.y - view.grid.y * 0.5;
  var output: VertexOutput;
  output.world = vec3f(position.x, bed[index].x, position.y);
  output.clip = project(output.world);
  return output;
}
fn hash2(position: vec2f) -> vec2f {
  var hashed = fract(vec3f(position.xyx) * vec3f(0.1031, 0.1030, 0.0973));
  hashed += dot(hashed, hashed.yzx + 33.33);
  return fract((hashed.xx + hashed.yz) * hashed.zy);
}
struct GrainAppearance {
  offset: vec2f,
  color: vec2f,
  edge: f32,
  roundness: f32,
}
fn grainAppearance(coordinate: vec2f) -> GrainAppearance {
  let baseCell = floor(coordinate);
  var nearest = 100.0;
  var second = 100.0;
  var grainOffset = vec2f(0.0);
  var grainColor = vec2f(0.5);
  for (var row = -1; row <= 1; row++) {
    for (var column = -1; column <= 1; column++) {
      let cell = baseCell + vec2f(f32(column), f32(row));
      let random = hash2(cell);
      let offset = coordinate - cell - (0.18 + 0.64 * random);
      let distance = dot(offset, offset);
      if (distance < nearest) {
        second = nearest; nearest = distance; grainOffset = offset; grainColor = random;
      } else { second = min(second, distance); }
    }
  }
  let boundary = sqrt(second) - sqrt(nearest);
  return GrainAppearance(grainOffset, grainColor, smoothstep(0.015, 0.13, boundary),
    sqrt(max(0.0, 1.0 - min(nearest / 0.42, 1.0))));
}
fn toneMap(color: vec3f) -> vec3f {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}
fn toSrgb(color: vec3f) -> vec3f {
  return select(color * 12.92, 1.055 * pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055, color > vec3f(0.0031308));
}
fn environment(direction: vec3f) -> vec3f {
  let upward = max(direction.y, 0.0);
  let sky = mix(vec3f(0.72, 0.67, 0.57), vec3f(0.42, 0.56, 0.78), pow(upward, 0.45));
  let ground = mix(vec3f(0.25, 0.19, 0.13), vec3f(0.52, 0.42, 0.29), smoothstep(-1.0, 0.0, direction.y));
  return select(ground, sky, direction.y >= 0.0);
}
fn treeShadow(position: vec2f) -> f32 {
  let center = view.shadowBounds.xy;
  let halfSize = view.shadowBounds.zw;
  let shadowOpacity = view.shadowControl.x;
  let uv = (position - (center - halfSize)) / (halfSize * 2.0);
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 1.0; }
  let mask = textureSampleLevel(shadowTexture, shadowSampler, uv, 0.0).x;
  return 1.0 - mask * shadowOpacity;
}
fn fresnelSchlickColor(f0: vec3f, cosine: f32) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - cosine, 5.0);
}
fn microfacetDistribution(alphaSquared: f32, normalHalf: f32) -> f32 {
  let denominator = normalHalf * normalHalf * (alphaSquared - 1.0) + 1.0;
  return alphaSquared / max(3.141593 * denominator * denominator, 0.0001);
}
fn geometryAttenuation(cosine: f32, viewCosine: f32) -> f32 {
  return cosine * viewCosine / max((cosine * 0.7 + 0.3) * (viewCosine * 0.7 + 0.3), 0.001);
}
fn reflectiveSpeckAt(position: vec2f, normal: vec3f, towardEye: vec3f, light: vec3f, shade: f32, detail: f32) -> vec3f {
  let cellSize = 0.0048;
  let cell = floor(position / cellSize);
  let selector = hash2(cell + vec2f(13.7, 41.3));
  let selected = smoothstep(0.992, 0.9985, selector.x);
  let centerSeed = hash2(cell + vec2f(73.1, 19.6));
  let center = (cell + 0.12 + centerSeed * 0.76) * cellSize;
  let pixelWidth = max(length(dpdx(position)), length(dpdy(position)));
  let radius = mix(0.00013, 0.00024, centerSeed.y);
  let coverage = selected * (1.0 - smoothstep(radius, radius + max(pixelWidth * 1.15, 0.00003), length(position - center)));
  let orientation = hash2(cell + vec2f(101.9, 7.4)) - 0.5;
  let microNormal = normalize(normal + vec3f(orientation.x, 0.0, orientation.y) * 0.58);
  let halfway = normalize(light + towardEye);
  let cosine = max(0.0, dot(microNormal, light));
  let viewCosine = max(0.02, dot(microNormal, towardEye));
  let normalHalf = max(0.0, dot(microNormal, halfway));
  let roughness = mix(0.024, 0.06, selector.y);
  let alphaSquared = pow(roughness, 4.0);
  let distribution = microfacetDistribution(alphaSquared, normalHalf);
  let geometry = geometryAttenuation(cosine, viewCosine);
  let fresnel = fresnelSchlickColor(mix(vec3f(0.055, 0.054, 0.050), vec3f(0.095, 0.090, 0.082), centerSeed.x), max(0.0, dot(halfway, towardEye)));
  let directSpecular = distribution * geometry / max(4.0 * cosine * viewCosine, 0.001);
  let reflected = reflect(-towardEye, microNormal);
  let sunlit = smoothstep(0.72, 0.94, shade);
  let environmentSpecular = environment(reflected) * fresnel * pow(1.0 - roughness, 2.0) * 1.12 * mix(0.30, 1.0, sunlit);
  let directColor = vec3f(1.0, 0.89, 0.69) * 3.2 * cosine * directSpecular * fresnel;
  return coverage * mix(0.68, 1.0, detail) * sunlit * (directColor + environmentSpecular);
}
struct FragmentOutput { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 }
@fragment fn fragment(input: VertexOutput) -> FragmentOutput {
  let position = input.world.xz;
  let spacing = view.grid.y / view.grid.x;
  let heightLeft = stateAt(position - vec2f(spacing, 0.0)).x;
  let heightRight = stateAt(position + vec2f(spacing, 0.0)).x;
  let heightBack = stateAt(position - vec2f(0.0, spacing)).x;
  let heightFront = stateAt(position + vec2f(0.0, spacing)).x;
  let macroNormal = normalize(vec3f(heightLeft - heightRight, 2.0 * spacing, heightBack - heightFront));
  let grainCoordinate = position / 0.00043;
  let footprint = max(length(dpdx(grainCoordinate)), length(dpdy(grainCoordinate)));
  let detail = 1.0 - smoothstep(0.55, 2.1, footprint);
  let baseCell = floor(grainCoordinate);
  var nearest = 100.0;
  var second = 100.0;
  var grainOffset = vec2f(0.0);
  var grainColor = vec2f(0.5);
  for (var row = -1; row <= 1; row++) {
    for (var column = -1; column <= 1; column++) {
      let cell = baseCell + vec2f(f32(column), f32(row));
      let random = hash2(cell);
      let offset = grainCoordinate - cell - (0.18 + 0.64 * random);
      let distance = dot(offset, offset);
      if (distance < nearest) {
        second = nearest; nearest = distance; grainOffset = offset; grainColor = random;
      } else { second = min(second, distance); }
    }
  }
  let boundary = sqrt(second) - sqrt(nearest);
  let grainEdge = smoothstep(0.015, 0.13, boundary);
  let roundness = sqrt(max(0.0, 1.0 - min(nearest / 0.42, 1.0)));
  let grainHeight = detail * grainEdge * roundness * mix(0.000045, 0.000115, grainColor.x);
  let facet = (grainColor - 0.5) * 0.52 + grainOffset * (0.38 + roundness * 0.42);
  let normal = normalize(macroNormal + vec3f(facet.x, 0.0, facet.y) * detail);
  let displacedWorld = input.world + macroNormal * grainHeight;
  let light = normalize(view.light.xyz);
  let towardEye = normalize(view.eye.xyz - displacedWorld);
  let halfway = normalize(light + towardEye);
  let cosine = max(0.0, dot(normal, light));
  let viewCosine = max(0.02, dot(normal, towardEye));
  let illumination = illuminationAt(position);
  let shade = treeShadow(position);
  let visibility = illumination.x * shade;
  let occlusion = illumination.y;
  let microOcclusion = mix(1.0, mix(0.68, 1.0, grainEdge), detail);
  let mineral = mix(vec3f(0.46, 0.315, 0.17), vec3f(0.72, 0.56, 0.33), grainColor.x);
  let darkGrain = mix(1.0, 0.3, smoothstep(0.94, 0.985, grainColor.y));
  let albedo = mix(vec3f(0.59, 0.435, 0.25), mineral * darkGrain * mix(0.62, 1.0, grainEdge), detail);
  let roughness = mix(0.80, 0.42, grainColor.y * detail);
  let alphaSquared = pow(roughness, 4.0);
  let normalHalf = max(0.0, dot(normal, halfway));
  let distribution = microfacetDistribution(alphaSquared, normalHalf);
  let fresnel = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(halfway, towardEye)), 5.0);
  let geometry = geometryAttenuation(cosine, viewCosine);
  let specular = distribution * fresnel * geometry / max(4.0 * cosine * viewCosine, 0.001);
  let diffuse = cosine * (0.84 + 0.16 * (1.0 - viewCosine));
  let ambient = environment(normal) * (0.24 + 0.16 * macroNormal.y) * occlusion * microOcclusion * mix(0.70, 1.0, shade);
  let direct = vec3f(1.0, 0.89, 0.69) * 2.55 * visibility * microOcclusion;
  let reflected = reflect(-towardEye, normal);
  let environmentSpecular = environment(reflected) * fresnel * pow(1.0 - roughness, 2.0) * 0.32 * occlusion * mix(0.42, 1.0, shade);
  let reflectiveSpeck = reflectiveSpeckAt(position, normal, towardEye, light, shade, detail);
  var radiance = albedo * (ambient + direct * diffuse) + direct * specular * cosine + environmentSpecular + reflectiveSpeck;
  let ringDistance = abs(length(position - view.pointer.xy) - view.pointer.z);
  let ring = (1.0 - smoothstep(0.0003, 0.0008, ringDistance)) * view.pointer.w;
  radiance *= 1.0 - 0.2 * ring;
  let projected = project(displacedWorld);
  var output: FragmentOutput;
  output.color = vec4f(toSrgb(toneMap(radiance)), 1.0);
  output.depth = projected.z / projected.w;
  return output;
}
@fragment fn fragmentMobile(input: VertexOutput) -> FragmentOutput {
  let position = input.world.xz;
  let spacing = view.grid.y / view.grid.x;
  let heightLeft = stateAt(position - vec2f(spacing, 0.0)).x;
  let heightRight = stateAt(position + vec2f(spacing, 0.0)).x;
  let heightBack = stateAt(position - vec2f(0.0, spacing)).x;
  let heightFront = stateAt(position + vec2f(0.0, spacing)).x;
  let macroNormal = normalize(vec3f(heightLeft - heightRight, 2.0 * spacing, heightBack - heightFront));
  let grainCoordinate = position / 0.00043;
  let grainDx = dpdx(grainCoordinate);
  let grainDy = dpdy(grainCoordinate);
  let footprint = max(length(grainDx), length(grainDy));

  // The physical grain generator is a jittered Voronoi lattice. When its
  // projected spacing approaches the framebuffer sampling rate, sampling every
  // pixel at the same phase produces the perspective fan/ring moire seen on
  // phones. Decorrelate that phase with one stable stochastic sample inside the
  // real pixel footprint. This is an unbiased spatial sample of the same
  // world-space material, not a second screen-space grain texture.
  let stochasticAmount = smoothstep(0.32, 0.58, footprint);
  let pixel = floor(input.clip.xy);
  let jitter = hash2(pixel + vec2f(19.0, 71.0)) - 0.5;
  let filteredCoordinate = grainCoordinate + stochasticAmount * (grainDx * jitter.x + grainDy * jitter.y);
  let grain = grainAppearance(filteredCoordinate);
  let grainOffset = grain.offset;
  let grainColor = grain.color;
  let grainEdge = grain.edge;
  let roundness = grain.roundness;
  let detail = 1.0 - smoothstep(0.55, 2.1, footprint);
  let depthDetail = detail * (1.0 - smoothstep(0.48, 0.90, footprint));
  let grainHeight = depthDetail * grainEdge * roundness * mix(0.000045, 0.000115, grainColor.x);
  let facet = (grainColor - 0.5) * 0.52 + grainOffset * (0.38 + roundness * 0.42);
  let normal = normalize(macroNormal + vec3f(facet.x, 0.0, facet.y) * detail);
  let displacedWorld = input.world + macroNormal * grainHeight;
  let light = normalize(view.light.xyz);
  let towardEye = normalize(view.eye.xyz - displacedWorld);
  let halfway = normalize(light + towardEye);
  let cosine = max(0.0, dot(normal, light));
  let viewCosine = max(0.02, dot(normal, towardEye));
  let illumination = illuminationAt(position);
  let shade = treeShadow(position);
  let visibility = illumination.x * shade;
  let occlusion = illumination.y;
  let microOcclusion = mix(1.0, mix(0.68, 1.0, grainEdge), detail);
  let mineral = mix(vec3f(0.46, 0.315, 0.17), vec3f(0.72, 0.56, 0.33), grainColor.x);
  let darkGrain = mix(1.0, 0.3, smoothstep(0.94, 0.985, grainColor.y));
  let albedo = mix(vec3f(0.59, 0.435, 0.25), mineral * darkGrain * mix(0.62, 1.0, grainEdge), detail);
  let roughness = mix(0.80, 0.42, grainColor.y * detail);
  let alphaSquared = pow(roughness, 4.0);
  let normalHalf = max(0.0, dot(normal, halfway));
  let distribution = microfacetDistribution(alphaSquared, normalHalf);
  let fresnel = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(halfway, towardEye)), 5.0);
  let geometry = geometryAttenuation(cosine, viewCosine);
  let specular = distribution * fresnel * geometry / max(4.0 * cosine * viewCosine, 0.001);
  let diffuse = cosine * (0.84 + 0.16 * (1.0 - viewCosine));
  let ambient = environment(normal) * (0.24 + 0.16 * macroNormal.y) * occlusion * microOcclusion * mix(0.70, 1.0, shade);
  let direct = vec3f(1.0, 0.89, 0.69) * 2.55 * visibility * microOcclusion;
  let reflected = reflect(-towardEye, normal);
  let environmentSpecular = environment(reflected) * fresnel * pow(1.0 - roughness, 2.0) * 0.32 * occlusion * mix(0.42, 1.0, shade);
  let reflectiveSpeck = reflectiveSpeckAt(position, normal, towardEye, light, shade, detail);
  var radiance = albedo * (ambient + direct * diffuse) + direct * specular * cosine + environmentSpecular + reflectiveSpeck;
  let ringDistance = abs(length(position - view.pointer.xy) - view.pointer.z);
  let ring = (1.0 - smoothstep(0.0003, 0.0008, ringDistance)) * view.pointer.w;
  radiance *= 1.0 - 0.2 * ring;
  let projected = project(displacedWorld);
  var output: FragmentOutput;
  output.color = vec4f(toSrgb(toneMap(radiance)), 1.0);
  output.depth = projected.z / projected.w;
  return output;
}
struct GrainOutput {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) tint: f32,
  @location(2) center: vec3f,
  @location(3) radius: f32,
}
@vertex fn grainVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> GrainOutput {
  let corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let grain = grains[instance];
  let corner = corners[vertex];
  let radius = select(0.0, 0.00016 * pow(grain.position.w / 0.000004, 1.0 / 3.0), grain.position.w > 0.0);
  let position = grain.position.xyz + (view.right.xyz * corner.x + view.up.xyz * corner.y) * radius;
  var output: GrainOutput;
  output.clip = select(vec4f(2.0, 2.0, 2.0, 1.0), project(position), grain.position.w > 0.0);
  output.local = corner;
  output.tint = hash2(vec2f(f32(instance), 17.0)).x;
  output.center = grain.position.xyz;
  output.radius = radius;
  return output;
}
struct GrainFragmentOutput { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 }
@fragment fn grainFragment(input: GrainOutput) -> GrainFragmentOutput {
  let squared = dot(input.local, input.local);
  if (squared > 1.0) { discard; }
  let sphereDepth = sqrt(1.0 - squared);
  let normal = normalize(view.right.xyz * input.local.x + view.up.xyz * input.local.y - view.forward.xyz * sphereDepth);
  let surface = input.center + (view.right.xyz * input.local.x + view.up.xyz * input.local.y - view.forward.xyz * sphereDepth) * input.radius;
  let light = normalize(view.light.xyz);
  let towardEye = normalize(view.eye.xyz - surface);
  let halfway = normalize(light + towardEye);
  let diffuse = max(0.0, dot(normal, light));
  let fresnel = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(halfway, towardEye)), 5.0);
  let sparkle = pow(max(0.0, dot(normal, halfway)), 36.0) * fresnel;
  let albedo = mix(vec3f(0.46, 0.315, 0.17), vec3f(0.72, 0.56, 0.33), input.tint);
  let shade = treeShadow(surface.xz);
  let ambient = environment(normal) * 0.34;
  let direct = vec3f(1.0, 0.89, 0.69) * 2.55 * diffuse * shade;
  let radiance = albedo * (ambient + direct) + environment(reflect(-towardEye, normal)) * sparkle * 0.55 * smoothstep(0.72, 0.94, shade);
  let projected = project(surface);
  var output: GrainFragmentOutput;
  output.color = vec4f(toSrgb(toneMap(radiance)), 1.0);
  output.depth = projected.z / projected.w;
  return output;
}
`,z=-.8,B=class{camera=new p;uniform;lighting;shadow;post;indices;indexCount;pipeline;grainPipeline;grainGroup;groups=[];depth;width=0;height=0;data=new Float32Array(36);device;solver;format;mobileGrainFiltering;constructor(e,t,n,r=!1){this.device=e,this.solver=t,this.format=n,this.mobileGrainFiltering=r,this.uniform=e.createBuffer({label:`Surface view`,size:this.data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.lighting=new F(e,t,this.uniform),this.shadow=new N(e,r),this.post=new L(e,n,n);let i=t.resolution;this.indexCount=(i-1)**2*6;let a=new Uint32Array(this.indexCount),o=0;for(let e=0;e<i-1;e++)for(let t=0;t<i-1;t++){let n=e*i+t;a.set([n,n+i,n+1,n+1,n+i,n+i+1],o),o+=6}this.indices=e.createBuffer({label:`Sand grid topology`,size:a.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.indices,0,a)}async initialize(){await Promise.all([this.lighting.initialize(),this.shadow.initialize(),this.post.initialize()]);let e=await d(this.device,`Granular surface WGSL`,R);this.pipeline=await this.device.createRenderPipelineAsync({label:`Granular sand surface`,layout:`auto`,vertex:{module:e,entryPoint:`vertex`},fragment:{module:e,entryPoint:this.mobileGrainFiltering?`fragmentMobile`:`fragment`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),this.groups=this.solver.buffers.map(e=>this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:e}},{binding:3,resource:{buffer:this.lighting.buffer}},{binding:4,resource:this.shadow.sampler},{binding:5,resource:this.shadow.texture.createView()}]})),this.grainPipeline=await this.device.createRenderPipelineAsync({label:`Loose sand grains`,layout:`auto`,vertex:{module:e,entryPoint:`grainVertex`},fragment:{module:e,entryPoint:`grainFragment`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),this.grainGroup=this.device.createBindGroup({layout:this.grainPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:2,resource:{buffer:this.solver.particles}},{binding:4,resource:this.shadow.sampler},{binding:5,resource:this.shadow.texture.createView()}]})}resize(e,t){(e!==this.width||t!==this.height)&&(this.depth?.destroy(),this.width=e,this.height=t,this.camera.aspect=e/t,this.depth=this.device.createTexture({label:`Surface depth`,size:[e,t],format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.post.resize(e,t),this.shadow.resize(e,t,(n,r)=>this.camera.screenToBed(n,r,e,t)))}encode(t,n,r,i,a=!1){if(!this.depth)throw Error(`Renderer needs a nonzero drawing buffer`);this.shadow.encode(t,i),this.data.set([...this.camera.eye,this.camera.tanHalfFov,...this.camera.forward,this.camera.aspect,...this.camera.right,0,...this.camera.up,0,Math.cos(z),.65,Math.sin(z),0,this.solver.resolution,e.extent,this.width,this.height,r.to.x,r.to.y,r.radius,+!!a,this.shadow.centerX,this.shadow.centerZ,this.shadow.halfWidth,this.shadow.halfHeight,this.shadow.opacity,0,0,0]),this.device.queue.writeBuffer(this.uniform,0,this.data),this.lighting.encode(t,z);let o=t.beginRenderPass({label:`Sand image`,colorAttachments:[{view:this.post.target,clearValue:{r:.55,g:.44,b:.29,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.pipeline),o.setBindGroup(0,this.groups[this.solver.stateIndex]),o.setIndexBuffer(this.indices,`uint32`),o.drawIndexed(this.indexCount),o.setPipeline(this.grainPipeline),o.setBindGroup(0,this.grainGroup),o.draw(6,this.solver.particleCount),o.end(),this.post.encode(t,n)}dispose(){this.lighting.dispose(),this.shadow.dispose(),this.post.dispose(),this.uniform.destroy(),this.indices.destroy(),this.depth?.destroy()}},V=class{previous;accumulator=0;droppedSeconds=0;step;maxSteps;constructor(e,t){this.step=e,this.maxSteps=t}advance(e){if(this.previous===void 0)return this.previous=e,0;let t=Math.max(0,(e-this.previous)/1e3);this.previous=e;let n=this.step*this.maxSteps;this.droppedSeconds+=Math.max(0,t-n),this.accumulator+=Math.min(t,n);let r=Math.min(this.maxSteps,Math.floor((this.accumulator+1e-9)/this.step));return this.accumulator-=r*this.step,r}reset(){this.previous=void 0,this.accumulator=0}},H=`
struct Flux { axial: vec4f, diagonal: vec4f }
const neighbors = array<vec2i, 8>(
  vec2i(-1, 0), vec2i(1, 0), vec2i(0, -1), vec2i(0, 1),
  vec2i(-1, -1), vec2i(1, 1), vec2i(1, -1), vec2i(-1, 1)
);
fn totalFlux(flow: Flux) -> f32 {
  return dot(flow.axial + flow.diagonal, vec4f(1.0));
}
fn fluxVector(flow: Flux) -> vec2f {
  return vec2f(flow.axial.y - flow.axial.x - flow.diagonal.x + flow.diagonal.y + flow.diagonal.z - flow.diagonal.w,
    flow.axial.w - flow.axial.z - flow.diagonal.x + flow.diagonal.y - flow.diagonal.z + flow.diagonal.w);
}
fn component(flow: Flux, direction: u32) -> f32 {
  if (direction < 4u) { return flow.axial[direction]; }
  return flow.diagonal[direction - 4u];
}
`,U=`
struct ToolContact {
  start: vec4f,
  end: vec4f,
  motion: vec4f,
}
struct Params {
  grid: vec4f,
  physics: vec4f,
  tool: vec4f,
  contacts: array<ToolContact, ${e.maxContacts}>,
}
`,W=`
${H}
${U}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> source: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> destination: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> flux: array<Flux>;
@group(0) @binding(4) var<storage, read_write> exchange: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read_write> contactField: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> contactPressure: array<f32>;

fn hash(position: vec2f) -> f32 {
  return fract(sin(dot(position, vec2f(127.1, 311.7))) * 43758.5453);
}
fn address(cell: vec2i) -> u32 {
  let bounded = clamp(cell, vec2i(0), vec2i(i32(params.grid.x) - 1));
  return u32(bounded.y) * u32(params.grid.x) + u32(bounded.x);
}
fn location(cell: vec2i) -> vec2f {
  return (vec2f(cell) + 0.5) * params.grid.y - params.grid.z * 0.5;
}
struct ContactSample {
  field: vec4f,
  pressure: f32,
}
fn sampleTool(position: vec2f) -> ContactSample {
  var strongest = 0.0;
  var coverage = 0.0;
  var shell = 0.0;
  var motion = vec2f(0.0);
  var pressure = 0.0;
  for (var index = 0u; index < ${e.maxContacts}u; index++) {
    if (f32(index) >= params.tool.x) { break; }
    let tool = params.contacts[index];
    let segment = tool.end.xy - tool.start.xy;
    let along = clamp(dot(position - tool.start.xy, segment) / max(dot(segment, segment), 1e-10), 0.0, 1.0);
    let offset = position - tool.start.xy - along * segment;
    let distance = length(offset) / max(tool.start.z, 1e-7);
    let envelope = max(0.0, 1.0 - distance * distance);
    let localCoverage = envelope * envelope;
    let strength = localCoverage * tool.start.w;
    shell = max(shell, 1.0 - smoothstep(0.9, 1.55, distance));
    if (strength > strongest) {
      strongest = strength;
      coverage = localCoverage;
      motion = tool.motion.xy;
      pressure = tool.start.w;
    }
  }
  return ContactSample(vec4f(coverage, shell, motion), pressure);
}
fn contactAt(cell: vec2i) -> vec4f {
  if (params.tool.x <= 0.0) { return vec4f(0.0); }
  return contactField[address(cell)];
}
fn pressureAt(cell: vec2i) -> f32 {
  if (params.tool.x <= 0.0) { return 0.0; }
  return contactPressure[address(cell)];
}
@compute @workgroup_size(8, 8)
fn initialize(@builtin(global_invocation_id) invocation: vec3u) {
  if (any(invocation.xy >= vec2u(u32(params.grid.x)))) { return; }
  let cell = vec2i(invocation.xy);
  let position = location(cell);
  let height = params.physics.x + 0.00015 * (hash(vec2f(cell)) - 0.5)
    + 0.0004 * sin(position.x * 31.0 + sin(position.y * 23.0)) * sin(position.y * 27.0);
  destination[address(cell)] = vec4f(height, 0.0, 0.0, 0.0);
}
@compute @workgroup_size(8, 8)
fn contact(@builtin(global_invocation_id) invocation: vec3u) {
  if (any(invocation.xy >= vec2u(u32(params.grid.x)))) { return; }
  let cell = vec2i(invocation.xy);
  let sample = sampleTool(location(cell));
  contactField[address(cell)] = sample.field;
  contactPressure[address(cell)] = sample.pressure;
}
@compute @workgroup_size(8, 8)
fn transport(@builtin(global_invocation_id) invocation: vec3u) {
  if (any(invocation.xy >= vec2u(u32(params.grid.x)))) { return; }
  let cell = vec2i(invocation.xy);
  let position = location(cell);
  let center = source[address(cell)];
  let toolContact = contactAt(cell);
  let toolPressure = pressureAt(cell);
  let penetration = toolContact.x * toolPressure * params.tool.y;
  let effectiveHeight = center.x + penetration;
  let toolSpeed = length(toolContact.zw);
  let motionDirection = toolContact.zw / max(toolSpeed, 1e-8);
  let speedResponse = toolSpeed / (toolSpeed + 0.35);
  let centerShell = toolContact.y;
  var outgoing = Flux(vec4f(0.0), vec4f(0.0));
  var escape = Flux(vec4f(0.0), vec4f(0.0));
  for (var axis = 0u; axis < 8u; axis++) {
    let neighbor = cell + neighbors[axis];
    if (any(neighbor < vec2i(0)) || any(neighbor >= vec2i(i32(params.grid.x)))) { continue; }
    let other = source[address(neighbor)];
    let otherContact = contactAt(neighbor);
    let otherPenetration = otherContact.x * pressureAt(neighbor) * params.tool.y;
    let friction = mix(params.physics.z, params.physics.w, clamp(max(center.y, other.y) * 35.0, 0.0, 1.0));
    let linkLength = select(1.0, 1.41421356, axis >= 4u);
    let weight = select(0.66666667, 0.16666667, axis >= 4u);
    let axisDirection = vec2f(neighbors[axis]) / linkLength;
    let forward = max(0.0, dot(axisDirection, motionDirection));
    let neighborShell = otherContact.y;
    let contactYield = max(toolContact.x, otherContact.x);
    let disturbedShell = max(centerShell, neighborShell);
    let thresholdScale = min(mix(1.0, 0.08, contactYield), mix(1.0, 0.45, disturbedShell));
    let threshold = friction * params.grid.y * linkLength * thresholdScale;
    let excess = max(0.0, effectiveHeight - other.x - otherPenetration - threshold);
    let physicalThreshold = friction * params.grid.y * linkLength * mix(1.0, 0.45, disturbedShell);
    let physicalExcess = max(0.0, center.x - other.x - physicalThreshold);
    let supercritical = smoothstep(params.grid.y * 1.5, params.grid.y * 5.0, physicalExcess);
    let avalancheBoost = 1.0 + supercritical * mix(0.35, 0.85, max(contactYield, disturbedShell));
    var amount = excess * params.grid.w * params.tool.z * weight * avalancheBoost;
    amount *= 1.0 + toolContact.x * speedResponse * forward * 0.55;
    let edge = max(0.0, penetration - otherPenetration) / max(penetration, 1e-7);
    let sideways = toolContact.x * (1.0 - abs(dot(axisDirection, motionDirection))) * 0.06;
    let escapeWeight = (edge + sideways) * (1.0 + speedResponse * forward * 0.8) * weight;
    if (axis < 4u) {
      outgoing.axial[axis] = amount;
      escape.axial[axis] = escapeWeight;
    } else {
      outgoing.diagonal[axis - 4u] = amount;
      escape.diagonal[axis - 4u] = escapeWeight;
    }
  }
  let targetHeight = params.physics.x - penetration;
  let overlap = max(0.0, center.x - targetHeight);
  let existing = totalFlux(outgoing);
  let escapeTotal = totalFlux(escape);
  let evacuationFraction = mix(0.32, 0.46, speedResponse);
  let extra = max(0.0, overlap * evacuationFraction - existing);
  if (extra > 0.0 && escapeTotal > 1e-8) {
    outgoing.axial += escape.axial * (extra / escapeTotal);
    outgoing.diagonal += escape.diagonal * (extra / escapeTotal);
  }
  let total = totalFlux(outgoing);
  let available = max(0.0, center.x - params.physics.y);
  let limiter = min(1.0, available / max(total, 1e-10));
  flux[address(cell)] = Flux(outgoing.axial * limiter, outgoing.diagonal * limiter);
}
@compute @workgroup_size(8, 8)
fn integrate(@builtin(global_invocation_id) invocation: vec3u) {
  if (any(invocation.xy >= vec2u(u32(params.grid.x)))) { return; }
  let cell = vec2i(invocation.xy);
  let index = address(cell);
  let current = source[index];
  let outgoing = flux[index];
  var incoming = Flux(vec4f(0.0), vec4f(0.0));
  for (var axis = 0u; axis < 8u; axis++) {
    let neighbor = cell + neighbors[axis];
    if (any(neighbor < vec2i(0)) || any(neighbor >= vec2i(i32(params.grid.x)))) { continue; }
    let amount = component(flux[address(neighbor)], axis ^ 1u);
    if (axis < 4u) { incoming.axial[axis] = amount; }
    else { incoming.diagonal[axis - 4u] = amount; }
  }
  let transferred = f32(atomicExchange(&exchange[index], 0)) * 1e-9;
  let height = current.x + totalFlux(incoming) - totalFlux(outgoing) + transferred;
  let moved = totalFlux(incoming) + totalFlux(outgoing);
  let toolContact = contactAt(cell);
  let toolSpeed = length(toolContact.zw);
  let toolPressure = pressureAt(cell);
  let contactActivity = toolContact.x * toolPressure * toolSpeed * 0.004;
  let activity = max(max(current.y * exp(-params.grid.w * 10.0), moved / params.grid.w), contactActivity);
  let transportVelocity = (fluxVector(outgoing) - fluxVector(incoming)) * params.grid.y / max(height * params.grid.w, 1e-7);
  let slipCoupling = 0.38 / (1.0 + toolSpeed * 0.30);
  let toolVelocity = toolContact.zw * toolContact.x * toolPressure * slipCoupling;
  let velocity = transportVelocity + toolVelocity;
  destination[index] = vec4f(height, activity, mix(current.zw, velocity, 0.4));
}
`,G=`
${H}
${U}
struct Grain { position: vec4f, velocity: vec4f }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> bed: array<vec4f>;
@group(0) @binding(2) var<storage, read> flux: array<Flux>;
@group(0) @binding(3) var<storage, read_write> grains: array<Grain>;
@group(0) @binding(4) var<storage, read_write> exchange: array<atomic<i32>>;
fn random(seed: u32) -> f32 {
  var value = seed * 747796405u + 2891336453u;
  value = ((value >> ((value >> 28u) + 4u)) ^ value) * 277803737u;
  return f32((value >> 22u) ^ value) / 4294967295.0;
}
fn address(position: vec2f) -> u32 {
  let cell = vec2u(clamp((position / params.grid.z + 0.5) * params.grid.x, vec2f(0.0), vec2f(params.grid.x - 1.0)));
  return cell.y * u32(params.grid.x) + cell.x;
}
fn heightAt(cell: vec2i) -> f32 {
  let bounded = vec2u(clamp(cell, vec2i(0), vec2i(i32(params.grid.x) - 1)));
  return bed[bounded.y * u32(params.grid.x) + bounded.x].x;
}
fn contactAt(position: vec2f) -> vec3f {
  let coordinate = (position / params.grid.z + 0.5) * params.grid.x - 0.5;
  let cell = vec2i(floor(coordinate));
  let blend = fract(coordinate);
  let lowerLeft = heightAt(cell);
  let lowerRight = heightAt(cell + vec2i(1, 0));
  let upperLeft = heightAt(cell + vec2i(0, 1));
  let upperRight = heightAt(cell + vec2i(1, 1));
  if (blend.x + blend.y <= 1.0) {
    let gradient = vec2f(lowerRight - lowerLeft, upperLeft - lowerLeft);
    return vec3f(lowerLeft + dot(gradient, blend), gradient / params.grid.y);
  }
  let gradient = vec2f(upperRight - upperLeft, upperRight - lowerRight);
  return vec3f(upperRight + dot(gradient, blend - 1.0), gradient / params.grid.y);
}
@compute @workgroup_size(64)
fn animate(@builtin(global_invocation_id) invocation: vec3u) {
  let index = invocation.x;
  if (index >= arrayLength(&grains)) { return; }
  var grain = grains[index];
  if (grain.position.w > 0.0) {
    grain.velocity.y -= 9.81 * params.grid.w;
    grain.position = vec4f(grain.position.xyz + grain.velocity.xyz * params.grid.w, grain.position.w);
    grain.velocity.w += params.grid.w;
    let limit = params.grid.z * 0.5 - params.grid.y;
    grain.position.x = clamp(grain.position.x, -limit, limit);
    grain.position.z = clamp(grain.position.z, -limit, limit);
    let cell = address(grain.position.xz);
    let surface = contactAt(grain.position.xz);
    if (grain.position.y <= surface.x + 0.00014) {
      let normal = normalize(vec3f(-surface.y, 1.0, -surface.z));
      let normalSpeed = dot(grain.velocity.xyz, normal);
      if (normalSpeed < -0.08 && grain.velocity.w < 0.22) {
        grain.position.y = surface.x + 0.00018;
        let tangent = grain.velocity.xyz - normal * normalSpeed;
        let friction = max(0.0, 1.0 - params.physics.w * 1.22 * abs(normalSpeed) / max(length(tangent), 1e-7));
        grain.velocity = vec4f(tangent * friction - normal * normalSpeed * 0.22, grain.velocity.w);
      } else {
        atomicAdd(&exchange[cell], i32(round(grain.position.w * 1e9)));
        grain.position.w = 0.0;
        grain.velocity.w = 0.0;
      }
    }
  } else {
    let stride = max(1u, u32(params.grid.x * params.grid.x) / arrayLength(&grains));
    grain.velocity.w += 1.0;
    let seed = index * 991u + u32(grain.velocity.w);
    let cell = min(index * stride + u32(grain.velocity.w) % stride, arrayLength(&bed) - 1u);
    let flow = flux[cell];
    let moved = totalFlux(flow);
    let reserve = bed[cell].x - moved - params.physics.y;
    let bedVelocity = bed[cell].zw;
    let speed = length(bedVelocity);
    let agitation = smoothstep(0.055, 0.24, speed);
    let sourceMoved = max(moved, bed[cell].y * params.grid.w * 0.35);
    let mass = mix(0.0000025, 0.0000055, random(seed + 13u));
    let launchMass = sourceMoved * f32(stride) * agitation * 0.004;
    let launchChance = min(1.0, launchMass / mass);
    if (reserve > mass * 1.2 && random(seed) < launchChance) {
      let position = (vec2f(f32(cell % u32(params.grid.x)), f32(cell / u32(params.grid.x))) + 0.5) * params.grid.y - params.grid.z * 0.5;
      let transport = fluxVector(flow);
      let direction = select(transport / max(length(transport), 1e-9), bedVelocity / max(speed, 1e-9), speed > 0.01);
      let side = vec2f(-direction.y, direction.x);
      let scatter = (random(seed + 31u) - 0.5) * (0.02 + speed * 0.12);
      let horizontal = bedVelocity * (0.68 + random(seed + 5u) * 0.22) + direction * (0.018 + speed * 0.12) + side * scatter;
      let lift = 0.018 + sqrt(max(speed, 0.0)) * (0.16 + random(seed + 7u) * 0.055);
      grain.position = vec4f(position.x, bed[cell].x + 0.0003, position.y, mass);
      grain.velocity = vec4f(horizontal.x, lift, horizontal.y, 0.0);
      atomicSub(&exchange[cell], i32(round(mass * 1e9)));
    }
  }
  grains[index] = grain;
}
`,K=3+e.maxContacts*3,q=K*16,J=class{buffers;flux;particles;particleCount;exchange;contact;contactPressure;particlePipeline;particleGroups=[];uniforms;pipelines;groups=[];current=0;generation=0;data=new Float32Array(K*4);byteLength;device;resolution;constructor(t,n=e.resolution){this.device=t,this.resolution=n,this.byteLength=n*n*16,this.buffers=[0,1].map(e=>t.createBuffer({label:`Sand state ${e}`,size:this.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST})),this.flux=t.createBuffer({label:`Eight-neighbor conservative flux`,size:this.byteLength*2,usage:GPUBufferUsage.STORAGE}),this.contact=t.createBuffer({label:`Pointer contact field`,size:this.byteLength,usage:GPUBufferUsage.STORAGE}),this.contactPressure=t.createBuffer({label:`Pointer contact pressure`,size:n*n*4,usage:GPUBufferUsage.STORAGE}),this.particleCount=Math.min(e.particles,n*n),this.particles=t.createBuffer({label:`Mass carrying grains`,size:this.particleCount*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.exchange=t.createBuffer({label:`Fixed-point grain exchange`,size:n*n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.uniforms=Array.from({length:e.maxSteps},()=>t.createBuffer({size:q,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}))}get state(){return this.buffers[this.current]}get stateIndex(){return this.current}get revision(){return this.generation}async initialize(){let e=await d(this.device,`Sand transport WGSL`,W),t=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),n=this.device.createPipelineLayout({bindGroupLayouts:[t]}),r=t=>this.device.createComputePipelineAsync({label:t,layout:n,compute:{module:e,entryPoint:t}}),[i,a,o,s]=await Promise.all([r(`initialize`),r(`contact`),r(`transport`),r(`integrate`)]);this.pipelines={initialize:i,contact:a,transport:o,integrate:s},this.groups=this.uniforms.map(e=>[0,1].map(n=>this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:{buffer:this.buffers[n]}},{binding:2,resource:{buffer:this.buffers[1-n]}},{binding:3,resource:{buffer:this.flux}},{binding:4,resource:{buffer:this.exchange}},{binding:5,resource:{buffer:this.contact}},{binding:6,resource:{buffer:this.contactPressure}}]})));let c=await d(this.device,`Mass carrying grains WGSL`,G);this.particlePipeline=await this.device.createComputePipelineAsync({layout:`auto`,compute:{module:c,entryPoint:`animate`}}),this.particleGroups=this.uniforms.map(e=>this.buffers.map(t=>this.device.createBindGroup({layout:this.particlePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:this.flux}},{binding:3,resource:{buffer:this.particles}},{binding:4,resource:{buffer:this.exchange}}]}))),this.reset()}writeParams(t,n){let r=n.filter(e=>e.active&&e.pressure>0).slice(0,e.maxContacts);return this.data.fill(0),this.data.set([this.resolution,e.extent/this.resolution,e.extent,e.step,e.depth,e.floor,e.repose,e.dynamicRepose,r.length,e.indentation,e.rate,0]),r.forEach((e,t)=>{let n=12+t*12;this.data.set([e.from.x,e.from.y,e.radius,e.pressure],n),this.data.set([e.to.x,e.to.y,0,0],n+4),this.data.set([e.velocity.x,e.velocity.y,Math.hypot(e.velocity.x,e.velocity.y),0],n+8)}),this.device.queue.writeBuffer(this.uniforms[t],0,this.data),r.length}reset(){this.generation++,this.writeParams(0,[]);let e=this.device.createCommandEncoder();e.clearBuffer(this.particles),e.clearBuffer(this.exchange);let t=e.beginComputePass();t.setPipeline(this.pipelines.initialize),t.setBindGroup(0,this.groups[0][1-this.current]),t.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8)),t.end(),this.device.queue.submit([e.finish()])}encode(t,n){if(n.length>e.maxSteps)throw Error(`Simulation substep budget exceeded`);n.forEach((e,n)=>{let r=this.writeParams(n,e),i=t.beginComputePass({label:`Sand conservative transport`});i.setBindGroup(0,this.groups[n][this.current]),r>0&&(i.setPipeline(this.pipelines.contact),i.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8))),i.setPipeline(this.pipelines.transport),i.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8)),i.setPipeline(this.particlePipeline),i.setBindGroup(0,this.particleGroups[n][this.current]),i.dispatchWorkgroups(Math.ceil(this.particleCount/64)),i.setPipeline(this.pipelines.integrate),i.setBindGroup(0,this.groups[n][this.current]),i.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8)),i.end(),this.current=1-this.current,this.generation++})}dispose(){[...this.buffers,this.flux,this.particles,this.exchange,this.contact,this.contactPressure,...this.uniforms].forEach(e=>e.destroy())}};async function Y(n,r){let i=await s(n.canvas,r),a=new J(i.device),c=new B(i.device,a,i.format,l()),d=new V(e.step,e.maxSteps),f=new AbortController,p,m=0,h=!1,g=!1,_=!0,v=!1,y=()=>{h||(h=!0,cancelAnimationFrame(m),f.abort(),p?.dispose(),c.dispose(),a.dispose(),i.dispose())};r.setStop(y);let b=()=>{if(!_)return;let e=u(window.innerWidth,window.innerHeight,window.devicePixelRatio);e&&(_=!1,n.canvas.width=e.width,n.canvas.height=e.height,c.resize(e.width,e.height))};try{r.stage(`Initializing sand transport`),await a.initialize(),r.stage(`Compiling granular lighting`),await c.initialize(),r.stage(`Rendering the first surface`),b();let e=i.device.createCommandEncoder();a.encode(e,[[],[]]),c.encode(e,i.context.getCurrentTexture().createView(),t(),performance.now()),i.device.queue.submit([e.finish()]),await i.device.queue.onSubmittedWorkDone(),r.assertHealthy(),p=new o(n,c.camera,()=>{v=!0});let s=e=>{if(!h){if(m=requestAnimationFrame(s),document.hidden||g){d.reset();return}try{b(),v&&=(a.reset(),d.reset(),!1);let t=d.advance(e),n=i.device.createCommandEncoder(),o=p;a.encode(n,Array.from({length:t},()=>o.strokes.nextBatch())),c.encode(n,i.context.getCurrentTexture().createView(),o.strokes.cursor,e,o.showPointer),i.device.queue.submit([n.finish()]),g=!0,i.device.queue.onSubmittedWorkDone().then(()=>{g=!1}).catch(e=>r.fail(e))}catch(e){r.fail(e)}}};window.addEventListener(`resize`,()=>{_=!0},{signal:f.signal}),window.visualViewport?.addEventListener(`resize`,()=>{_=!0},{signal:f.signal}),document.addEventListener(`visibilitychange`,()=>d.reset(),{signal:f.signal}),window.addEventListener(`pagehide`,y,{once:!0,signal:f.signal}),m=requestAnimationFrame(s)}catch(e){throw y(),e}}export{Y as startSandboard};