var e=String.raw`
class SandProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.gateTarget = 0;
    this.speedTarget = 0;
    this.pressureTarget = 0;
    this.turnTarget = 0;

    this.gate = 0;
    this.speed = 0;
    this.pressure = 0;
    this.turn = 0;

    this.seedL = 0x12345678;
    this.seedR = 0x87654321;

    this.lpL = this.lpR = 0;
    this.lp2L = this.lp2R = 0;
    this.slowL = this.slowR = 0;
    this.highLpL = this.highLpR = 0;

    this.grainEnvL = this.grainEnvR = 0;
    this.grainToneL = this.grainToneR = 0;
    this.grainPhaseL = this.grainPhaseR = 0;
    this.grainFreqL = this.grainFreqR = 2600;

    this.crunchEnv = 0;
    this.ridgePhase = 0;

    this.port.onmessage = e => {
      const d = e.data || {};
      if (d.type === 'state') {
        this.gateTarget = d.gate ? 1 : 0;

        if (d.gate) {
          this.speedTarget = Math.max(0, Math.min(1.25, d.speed || 0));
          this.pressureTarget = Math.max(0, Math.min(1, d.pressure || 0));
          this.turnTarget = Math.max(0, Math.min(1, d.turn || 0));
        }
      }
    };
  }

  rnd(side) {
    if (side === 0) {
      let x = this.seedL | 0;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.seedL = x | 0;
      return ((x >>> 0) / 4294967296) * 2 - 1;
    } else {
      let x = this.seedR | 0;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.seedR = x | 0;
      return ((x >>> 0) / 4294967296) * 2 - 1;
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];
    const sr = sampleRate;

    for (let i = 0; i < L.length; i++) {
      const gCoef = this.gateTarget > this.gate ? 0.0045 : 0.00013;
      this.gate += (this.gateTarget - this.gate) * gCoef;

      if (this.gateTarget > 0.5) {
        this.speed += (this.speedTarget - this.speed) * 0.0017;
        this.pressure += (this.pressureTarget - this.pressure) * 0.0015;
        this.turn += (this.turnTarget - this.turn) * 0.0014;
      } else {
        this.speed *= 0.99970;
        this.pressure *= 0.99976;
        this.turn *= 0.99940;
      }

      const s = Math.max(0, Math.min(1, this.speed));
      const p = Math.max(0, Math.min(1, this.pressure));
      const strength = Math.pow(s, 0.78);
      const contact = this.gate * (0.055 + 0.70 * strength) * (0.92 + p * 0.08);

      const nL = this.rnd(0);
      const nR = this.rnd(1);
      const aBody = 0.010 + s * 0.032;
      const aSoft = 0.0030 + s * 0.0075;
      const aAir  = 0.11 + s * 0.10;

      this.lpL += (nL - this.lpL) * aBody;
      this.lpR += (nR - this.lpR) * aBody;
      this.slowL += (nL - this.slowL) * aSoft;
      this.slowR += (nR - this.slowR) * aSoft;
      this.highLpL += (nL - this.highLpL) * aAir;
      this.highLpR += (nR - this.highLpR) * aAir;

      const bodyL = this.lpL - this.slowL;
      const bodyR = this.lpR - this.slowR;
      const airL = nL - this.highLpL;
      const airR = nR - this.highLpR;

      const density = 20 + 520 * Math.pow(s, 1.35);
      if (Math.random() < density / sr) {
        this.grainEnvL = 0.10 + Math.random() * 0.38;
        this.grainFreqL = 1200 + Math.random() * (1700 + s * 2300);
      }
      if (Math.random() < density / sr) {
        this.grainEnvR = 0.10 + Math.random() * 0.38;
        this.grainFreqR = 1200 + Math.random() * (1700 + s * 2300);
      }

      this.grainPhaseL += this.grainFreqL / sr;
      this.grainPhaseR += this.grainFreqR / sr;
      if (this.grainPhaseL >= 1) this.grainPhaseL -= 1;
      if (this.grainPhaseR >= 1) this.grainPhaseR -= 1;
      const pingL = Math.sin(this.grainPhaseL * Math.PI * 2) * this.grainEnvL;
      const pingR = Math.sin(this.grainPhaseR * Math.PI * 2) * this.grainEnvR;
      const grainDecay = 0.978 - s * 0.004;
      this.grainEnvL *= grainDecay;
      this.grainEnvR *= grainDecay;

      const crunchRate = 1 + 18 * this.turn * (0.2 + s);
      if (Math.random() < crunchRate / sr) this.crunchEnv = .10 + Math.random() * .28;
      const crunch = (nL + nR) * .5 * this.crunchEnv;
      this.crunchEnv *= 0.986;

      this.ridgePhase += (18 + 54 * s) / sr;
      if (this.ridgePhase >= 1) this.ridgePhase -= 1;
      const ridge = Math.max(0, Math.sin(this.ridgePhase * Math.PI * 2));
      const ridgeMod = 0.97 + ridge * 0.03;

      const softMix = 0.50 - s * 0.09;
      const airMix = 0.007 + s * 0.025;
      const grainMix = 0.0025 + s * 0.010;

      let yL = bodyL * softMix + airL * airMix + pingL * grainMix + crunch * 0.018;
      let yR = bodyR * softMix + airR * airMix + pingR * grainMix + crunch * 0.018;

      yL = Math.tanh(yL * 1.05) * contact * ridgeMod;
      yR = Math.tanh(yR * 1.05) * contact * ridgeMod;

      const mid = (yL + yR) * .5;
      L[i] = mid * .72 + yL * .28;
      R[i] = mid * .72 + yR * .28;
    }
    return true;
  }
}
registerProcessor('sand-processor', SandProcessor);
`,t=.08,n=.92,r=.34,i=1,a=55;function o(e){return Math.max(0,Math.min(1,(e-24)/1080))}function s(e){return e.pointerType===`pen`?e.pressure:0}function c(){return/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1}function l(){if(!c())return;let e=navigator.audioSession;if(e)try{e.type=`playback`}catch{return}}var u=class{ambient=new Audio(`/scene_assets/beach.mp3`);wave=new Audio(`/scene_assets/wave.mp3`);gestures=new Map;unlockController=new AbortController;context;ambientSource;ambientGain;waveSource;waveGain;sandNode;proceduralReady;prepareReady;waveMetadataReady;waveDuration=4.754;disposed=!1;constructor(){this.ambient.loop=!0,this.ambient.preload=`auto`,this.ambient.volume=1,this.ambient.setAttribute(`playsinline`,``),this.wave.preload=`auto`,this.wave.volume=1,this.wave.setAttribute(`playsinline`,``),this.waveMetadataReady=this.loadWaveMetadata();let e=()=>{this.activatePlayback()},{signal:t}=this.unlockController;window.addEventListener(`pointerdown`,e,{signal:t,passive:!0}),window.addEventListener(`keydown`,e,{signal:t})}prepare(){return this.prepareReady||=Promise.all([this.prepareAudio(),this.waveMetadataReady]).then(()=>void 0),this.prepareReady}beginPointer(e){this.disposed||(this.activatePlayback(),this.gestures.set(e.pointerId,{x:e.clientX,y:e.clientY,time:e.timeStamp,velocityX:0,velocityY:0,filteredSpeed:0,speed:.025,pressure:s(e),turn:0,audibleUntil:performance.now()+a}),this.sendGestureState())}movePointer(e,t=e.pointerId){let n=this.gestures.get(t);if(!n)return;let r=Math.max(i,e.timeStamp-n.time)/1e3,c=e.clientX-n.x,l=e.clientY-n.y,u=Math.hypot(c,l),d=u/r,f=1-Math.exp(-r*18);n.filteredSpeed+=(d-n.filteredSpeed)*f;let p=c/r,m=l/r,h=Math.hypot(p,m),g=Math.hypot(n.velocityX,n.velocityY),_=0;if(h>20&&g>20){let e=(p*n.velocityX+m*n.velocityY)/(h*g);_=Math.max(0,Math.min(1,(1-e)*.72))}let v=Math.hypot(p-n.velocityX,m-n.velocityY)/Math.max(3e3,h*8);_=Math.min(1,_+v*.35),n.x=e.clientX,n.y=e.clientY,n.time=e.timeStamp,n.velocityX=p,n.velocityY=m,n.speed=o(n.filteredSpeed),n.pressure=s(e),n.turn=_,u>0&&(n.audibleUntil=performance.now()+a),this.sendGestureState()}update(e){this.gestures.size&&this.sendGestureState(e)}endPointer(e){this.gestures.delete(e)&&this.sendGestureState()}cancelAll(){this.gestures.size&&(this.gestures.clear(),this.sendGestureState())}dispose(){this.disposed||(this.disposed=!0,this.unlockController.abort(),this.cancelAll(),this.sandNode?.disconnect(),this.sandNode=void 0,this.ambientSource?.disconnect(),this.ambientSource=void 0,this.ambientGain?.disconnect(),this.ambientGain=void 0,this.waveSource?.disconnect(),this.waveSource=void 0,this.waveGain?.disconnect(),this.waveGain=void 0,this.context&&this.context.close(),this.context=void 0,this.ambient.pause(),this.wave.pause(),this.wave.currentTime=0,this.ambient.removeAttribute(`src`),this.wave.removeAttribute(`src`),this.ambient.load(),this.wave.load())}async prepareAudio(){if(this.disposed)return;let e=this.ensureContext(),t=this.ensureProcedural(e);this.activatePlayback(),await t}activatePlayback(){if(this.disposed)return;let e=this.ensureContext();e.state!==`running`&&e.resume().catch(()=>void 0),this.playAmbient(),this.ensureProcedural(e).then(()=>this.sendGestureState())}ensureContext(){if(this.context)return this.context;l();let e=new AudioContext({latencyHint:`interactive`}),r=e.createMediaElementSource(this.ambient),i=new GainNode(e,{gain:t});r.connect(i).connect(e.destination);let a=e.createMediaElementSource(this.wave),o=new GainNode(e,{gain:n});return a.connect(o).connect(e.destination),this.context=e,this.ambientSource=r,this.ambientGain=i,this.waveSource=a,this.waveGain=o,e}get resetDurationSeconds(){return this.waveDuration}playResetWave(){if(this.disposed)return this.waveDuration;this.activatePlayback(),this.wave.pause();try{this.wave.currentTime=0}catch{}return this.wave.play().catch(()=>void 0),this.waveDuration}loadWaveMetadata(){return new Promise(e=>{let t=()=>{let t=this.wave.duration;Number.isFinite(t)&&t>0&&(this.waveDuration=t),e()};if(this.wave.readyState>=HTMLMediaElement.HAVE_METADATA){t();return}this.wave.addEventListener(`loadedmetadata`,t,{once:!0}),this.wave.addEventListener(`error`,()=>e(),{once:!0}),this.wave.load()})}async playAmbient(){!this.disposed&&this.ambient.paused&&await this.ambient.play().catch(()=>void 0)}ensureProcedural(e){return this.proceduralReady||=this.createProcedural(e).catch(e=>{console.warn(`[Sandboard audio] Procedural drawing sound unavailable.`,e)}),this.proceduralReady}async createProcedural(t){if(this.disposed||this.sandNode)return;let n=new Blob([e],{type:`text/javascript`}),i=URL.createObjectURL(n);try{await t.audioWorklet.addModule(i)}finally{URL.revokeObjectURL(i)}if(this.disposed||t!==this.context)return;let a=new AudioWorkletNode(t,`sand-processor`,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]}),o=new BiquadFilterNode(t,{type:`highpass`,frequency:90,Q:.7}),s=new BiquadFilterNode(t,{type:`peaking`,frequency:2200,Q:.75,gain:-4.8}),c=new BiquadFilterNode(t,{type:`lowpass`,frequency:4800,Q:.42}),l=new DynamicsCompressorNode(t,{threshold:-18,knee:16,ratio:2.2,attack:.004,release:.09}),u=new GainNode(t,{gain:r});a.connect(o).connect(s).connect(c).connect(l).connect(u).connect(t.destination),this.sandNode=a}sendGestureState(e=performance.now()){if(!this.sandNode)return;if(!this.gestures.size){this.sandNode.port.postMessage({type:`state`,gate:0,speed:0,pressure:0,turn:0});return}let t,n=-1;for(let r of this.gestures.values()){if(r.audibleUntil<e)continue;let i=r.speed*(.92+r.pressure*.08);i>n&&(t=r,n=i)}if(!t){this.sandNode.port.postMessage({type:`state`,gate:0,speed:0,pressure:0,turn:0});return}this.sandNode.port.postMessage({type:`state`,gate:1,speed:t.speed,pressure:t.pressure,turn:t.turn})}},d={resolution:512,extent:.8,depth:.032,floor:.003,repose:.625,dynamicRepose:.48,rate:32,step:1/120,maxSteps:4,radius:.012,indentation:.02,impactSpeedStart:.5,impactSpeedFull:1.2,impactIndentation:.01,impactEvacuation:.86,impactEjectionFraction:.075,impactParticleMassMin:12e-7,impactParticleMassMax:32e-7,airborneGrainRadius:16e-5,airborneReferenceMass:4e-6,airborneShadowResolution:512,airborneShadowStrength:1.7,particles:16384,maxContacts:8},f=()=>({from:{x:0,y:0},to:{x:0,y:0},velocity:{x:0,y:0},radius:d.radius,pressure:0,active:!1}),p=1e-4,m=d.step*.5,h=1e-7,g=d.maxContacts*d.maxSteps*4,_=class{tracks=new Map;roundRobin=0;currentPressure=.7;position={x:0,y:0};radius=d.radius;begin(e,t,n,r=0){let i=this.bound(e),a=this.tracks.get(r),o=this.timestamp(a,n),s={...i,time:o};this.position=i,this.currentPressure=this.clampPressure(t),this.tracks.set(r,{held:!0,pressure:this.currentPressure,start:s,latest:s,latestTime:o,segments:a?.segments??[]})}move(e,t,n,r=0){let i=this.bound(e);this.position=i,this.currentPressure=this.clampPressure(t);let a=this.tracks.get(r);if(!a||!a.held)return;let o=this.timestamp(a,n);a.pressure=this.currentPressure,a.latestTime=o,a.latest={...i,time:o},this.subdivide(a)}end(e=0){let t=this.tracks.get(e);t&&(t.held=!1,this.flush(t),this.prune(e,t))}cancel(e){if(e===void 0){this.tracks.clear(),this.roundRobin=0;return}this.tracks.delete(e),this.roundRobin>=this.tracks.size&&(this.roundRobin=0)}clampPressure(e){return Math.max(.1,Math.min(1,e))}bound(e){let t=d.extent/2-.03;return{x:Math.max(-t,Math.min(t,e.x)),y:Math.max(-t,Math.min(t,e.y))}}timestamp(e,t){let n=e?.latestTime,r=(n??-d.step*1e3)+d.step*1e3,i=t!==void 0&&Number.isFinite(t)?t:r;return n===void 0?i:Math.max(n,i)}spacing(){return Math.max(d.extent/d.resolution*1.5,this.radius*.5)}makeStroke(e,t,n){let r=(t.time-e.time)/1e3,i=r>0?Math.max(p,r):m;return{from:{x:e.x,y:e.y},to:{x:t.x,y:t.y},velocity:{x:(t.x-e.x)/i,y:(t.y-e.y)/i},radius:this.radius,pressure:n,active:!0}}subdivide(e){let t=this.spacing(),n=Math.hypot(e.latest.x-e.start.x,e.latest.y-e.start.y);for(;n>=t;){let r=t/n,i={x:e.start.x+(e.latest.x-e.start.x)*r,y:e.start.y+(e.latest.y-e.start.y)*r,time:e.start.time+(e.latest.time-e.start.time)*r};e.segments.push(this.makeStroke(e.start,i,e.pressure)),this.trimBacklog(e),e.start=i,n=Math.hypot(e.latest.x-e.start.x,e.latest.y-e.start.y)}}flush(e){Math.hypot(e.latest.x-e.start.x,e.latest.y-e.start.y)>h&&(e.segments.push(this.makeStroke(e.start,e.latest,e.pressure)),this.trimBacklog(e)),e.start=e.latest}trimBacklog(e){let t=e.segments.length-g;t>0&&e.segments.splice(0,t)}prune(e,t){!t.held&&t.segments.length===0&&this.tracks.delete(e)}drain(e){for(let e of this.tracks.values())e.held&&this.flush(e);let t=[...this.tracks.entries()];if(!t.length)return[];let n=[],r=0,i=this.roundRobin%t.length;for(;n.length<e&&r<t.length;){let[e,a]=t[i],o=a.segments.shift();o?(n.push(o),r=0,this.prune(e,a)):r++,i=(i+1)%t.length}return this.roundRobin=i,n}nextBatch(){return this.drain(d.maxContacts)}next(){return this.drain(1)[0]??{...f(),from:this.position,to:this.position,radius:this.radius,pressure:this.currentPressure}}get cursor(){return{...f(),from:this.position,to:this.position,radius:this.radius}}},v=-1,y=class{strokes=new _;showPointer=!1;pointers=new Set;pointerStartedAt=new Map;suppressedPointers=new Set;controller=new AbortController;canvas;keyboardDrawing=!1;interactive=!0;interactiveSince=-1/0;constructor(e,t,n,r){let{signal:i}=this.controller,a=e.canvas;this.canvas=a;let o=e=>{let n=a.getBoundingClientRect();return t.screenToBed(e.clientX-n.left,e.clientY-n.top,n.width,n.height)},s=e=>e.pointerType===`pen`?e.pressure:.75,c=e=>e.timeStamp>performance.timeOrigin?e.timeStamp-performance.timeOrigin:e.timeStamp,l=e=>{let t=this.pointerStartedAt.get(e.pointerId);if(t===void 0)return!1;let n=c(e);return Number.isFinite(n)&&n>0&&n<t};a.addEventListener(`pointerdown`,e=>{let t=c(e);if(this.pointers.has(e.pointerId))return;let r=Number.isFinite(t)&&t>0&&t<this.interactiveSince;if(!this.interactive||r){this.suppressedPointers.add(e.pointerId);return}if(this.suppressedPointers.delete(e.pointerId),e.pointerType===`mouse`&&e.button!==0)return;let i=Number.isFinite(t)&&t>0?t:performance.now();this.pointers.add(e.pointerId),this.pointerStartedAt.set(e.pointerId,i),a.setPointerCapture(e.pointerId),a.focus({preventScroll:!0}),this.strokes.begin(o(e),s(e),i,e.pointerId),n.beginPointer(e),this.showPointer=!1},{signal:i}),a.addEventListener(`pointermove`,e=>{if(!this.interactive||this.suppressedPointers.has(e.pointerId)||l(e))return;let t=e.getCoalescedEvents?.()??[];for(let r of t.length?t:[e])l(r)||(this.strokes.move(o(r),s(r),c(r),e.pointerId),n.movePointer(r,e.pointerId))},{signal:i}),a.addEventListener(`pointerup`,e=>{if(this.suppressedPointers.has(e.pointerId)&&!this.pointers.has(e.pointerId)){this.suppressedPointers.delete(e.pointerId),a.hasPointerCapture(e.pointerId)&&a.releasePointerCapture(e.pointerId);return}l(e)||(this.interactive||this.pointers.has(e.pointerId))&&this.pointers.has(e.pointerId)&&(this.strokes.move(o(e),s(e),c(e),e.pointerId),n.movePointer(e),this.strokes.end(e.pointerId),n.endPointer(e.pointerId),this.pointers.delete(e.pointerId),this.pointerStartedAt.delete(e.pointerId),this.suppressedPointers.delete(e.pointerId),a.hasPointerCapture(e.pointerId)&&a.releasePointerCapture(e.pointerId))},{signal:i});let u=e=>{this.suppressedPointers.delete(e),this.pointers.delete(e),this.pointerStartedAt.delete(e),this.strokes.cancel(e),n.endPointer(e)},d=(e=!1)=>{let t=[...this.pointers];if(e)for(let e of t)this.suppressedPointers.add(e);this.pointers.clear(),this.pointerStartedAt.clear();for(let e of t)a.hasPointerCapture(e)&&a.releasePointerCapture(e);this.keyboardDrawing=!1,this.strokes.cancel(),n.cancelAll()};a.addEventListener(`pointercancel`,e=>{l(e)||u(e.pointerId)},{signal:i}),a.addEventListener(`lostpointercapture`,e=>{this.pointers.has(e.pointerId)&&!l(e)&&u(e.pointerId)},{signal:i}),window.addEventListener(`blur`,()=>d(),{signal:i}),document.addEventListener(`visibilitychange`,()=>{document.hidden&&d()},{signal:i}),e.radius.addEventListener(`input`,()=>{this.strokes.radius=Number(e.radius.value)/1e3,this.showPointer=!0},{signal:i}),e.reset.addEventListener(`click`,()=>{this.interactive&&(d(!0),r())},{signal:i}),a.addEventListener(`keydown`,t=>{if(t.key.toLowerCase()===`r`){if(!this.interactive)return;d(!0),r()}if(!this.interactive)return;t.code===`Space`&&(t.preventDefault(),this.keyboardDrawing||=(this.strokes.begin(this.strokes.position,.75,t.timeStamp,v),!0));let n={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[t.key];n&&(t.preventDefault(),this.showPointer=!0,this.strokes.move({x:this.strokes.position.x+n[0]*.003,y:this.strokes.position.y+n[1]*.003},.75,t.timeStamp,v)),(t.key===`[`||t.key===`]`)&&(e.radius.value=String(Number(e.radius.value)+(t.key===`[`?-1:1)),this.strokes.radius=Number(e.radius.value)/1e3,this.showPointer=!0)},{signal:i}),a.addEventListener(`keyup`,e=>{e.code===`Space`&&(this.strokes.end(v),this.keyboardDrawing=!1)},{signal:i})}setInteractive(e){if(this.interactive!==e){if(this.interactive=e,!e){let e=[...this.pointers];for(let t of e)this.suppressedPointers.add(t);this.pointers.clear(),this.pointerStartedAt.clear();for(let t of e)this.canvas.hasPointerCapture(t)&&this.canvas.releasePointerCapture(t);this.keyboardDrawing=!1,this.showPointer=!1,this.strokes.cancel();return}this.strokes.cancel(),this.interactiveSince=performance.now()}}dispose(){this.controller.abort(),this.pointers.clear(),this.pointerStartedAt.clear(),this.suppressedPointers.clear(),this.strokes.cancel()}};async function b(e,t){if(!navigator.gpu)throw Error(`WebGPU is unavailable. A secure context and supported GPU/browser are required.`);t.stage(`Requesting GPU`);let n=await navigator.gpu.requestAdapter({powerPreference:`high-performance`});if(!n)throw Error(`No hardware WebGPU adapter is available.`);if(n.info.isFallbackAdapter)throw Error(`A hardware WebGPU adapter is required, not a software fallback.`);t.setAdapter([n.info.vendor,n.info.architecture,n.info.description].filter(Boolean).join(` / `));let r=await n.requestDevice({label:`Sandboard GPU`}),i=!1;r.lost.then(e=>{i||t.fail(Error(`GPU device lost (${e.reason}): ${e.message}`))}),r.addEventListener(`uncapturederror`,e=>t.fail(Error(`Uncaptured GPU error: ${e.error.message}`)));let a=e.getContext(`webgpu`);try{if(t.assertHealthy(),!a)throw Error(`The browser could not create a WebGPU canvas context.`);let e=navigator.gpu.getPreferredCanvasFormat();return a.configure({device:r,format:e,alphaMode:`opaque`}),{device:r,context:a,format:e,dispose:()=>{i=!0,a.unconfigure(),r.destroy()}}}catch(e){throw i=!0,r.destroy(),e}}var x=4.754,S=.44,C=96,w={coverageMargin:.1,visibleInset:.03,shorelineTilt:-.06,shorelineAmplitude:.018,shorelineFrequencyA:20,shorelineFrequencyB:10,shorelineFrequencyC:5.2,shorelineSpeedA:1.55,shorelineSpeedB:-.94,shorelineSpeedC:.62,shorelineBlend:.5,shorelineFeather:.018,waterMaskBackstep:.06,foamWidth:.052,foamTrail:.09,waterDepth:.14,waterOpacity:.5,waterTintStrength:.58,washGloss:.42,rippleScale:24,rippleDrift:.48},T=d.extent*.5,E=T-w.visibleInset,D=-T-w.coverageMargin,O=T+w.coverageMargin,k=-w.shorelineFeather*w.waterMaskBackstep,A={minX:-T,maxX:T,nearY:T};function j(e){let t=Math.max(0,Math.min(1,e));return t*t*(3-2*t)}function M(e,t,n){return e+(t-e)*n}function N(e,t){let n=Math.sin(e*w.shorelineFrequencyA+t*w.shorelineSpeedA),r=Math.sin(e*w.shorelineFrequencyB+t*w.shorelineSpeedB+1.7),i=Math.sin(e*w.shorelineFrequencyC-t*w.shorelineSpeedC+.6);return e*w.shorelineTilt+w.shorelineAmplitude*(n+r*w.shorelineBlend)+w.shorelineAmplitude*.55*i}function P(e=A){let t=Math.min(e.minX,e.maxX),n=Math.max(e.minX,e.maxX);return{minX:Number.isFinite(t)?t:A.minX,maxX:Number.isFinite(n)?n:A.maxX,nearY:Number.isFinite(e.nearY)?e.nearY:A.nearY}}function F(e,t=A){let n=P(t),r=1/0,i=0;for(let t=0;t<=C;t++){let a=N(n.minX+(n.maxX-n.minX)*t/C,e);a<r&&(r=a,i=t)}let a=n.minX+(n.maxX-n.minX)*Math.max(0,i-1)/C,o=n.minX+(n.maxX-n.minX)*Math.min(C,i+1)/C;for(let t=0;t<16;t++){let t=(o-a)/3,n=a+t,r=o-t;N(n,e)<=N(r,e)?o=r:a=n}return Math.min(r,N((a+o)*.5,e))}function I(e,t=A){let n=P(t);return n.nearY-k-F(e,n)}var L=I(x);function R(){return{active:!1,incoming:!1,justStarted:!1,justFinished:!1,erase:!1,time:0,previousBaseFront:L,currentBaseFront:L,progress:0,erasePreviousBaseFront:O,eraseCurrentBaseFront:O,erasePreviousTime:0,eraseCurrentTime:0}}var ee=class{active=!1;startedAt=0;durationSeconds=x;renderExitFront=L;viewport=A;retreatStartEnvelope=D+F(x*S);retreatExitEnvelope=T-k;previousRenderFront=E;previousEraseFront=O;previousEraseTime=0;firstUpdate=!0;start(e,t,n=A){this.active=!0,this.startedAt=e,this.durationSeconds=Number.isFinite(t)&&t&&t>0?t:x;let r=this.durationSeconds*S;this.viewport=P(n),this.renderExitFront=I(this.durationSeconds,this.viewport),this.retreatStartEnvelope=D+F(r,this.viewport),this.retreatExitEnvelope=this.viewport.nearY-k,this.previousRenderFront=E,this.previousEraseFront=O,this.previousEraseTime=0,this.firstUpdate=!0}update(e){if(!this.active)return R();let t=Math.max(0,(e-this.startedAt)/1e3),n=Math.max(this.durationSeconds*S,.001),r=Math.max(this.durationSeconds-n,.001),i=this.previousRenderFront,a=Math.min(t,n),o=M(E,D,j(a/n)),s=o<this.previousEraseFront-1e-6,c=!0,l,u,d=!0,f=!1;t<n?(l=j(t/n),u=M(E,D,l)):t<this.durationSeconds?(c=!1,l=j((t-n)/r),u=M(this.retreatStartEnvelope,this.retreatExitEnvelope,l)-F(t,this.viewport)):(c=!1,l=1,u=this.renderExitFront,d=!1,f=!0);let p={active:d,incoming:c,justStarted:this.firstUpdate,justFinished:f,erase:s,time:Math.min(t,this.durationSeconds),previousBaseFront:i,currentBaseFront:u,progress:l,erasePreviousBaseFront:this.previousEraseFront,eraseCurrentBaseFront:o,erasePreviousTime:this.previousEraseTime,eraseCurrentTime:a};return this.firstUpdate=!1,this.previousRenderFront=u,s&&(this.previousEraseFront=o,this.previousEraseTime=a),f&&(this.active=!1),p}};function te(e){let t=e.screenToBed(0,1,1,1),n=e.screenToBed(1,1,1,1);return{minX:Math.min(t.x,n.x),maxX:Math.max(t.x,n.x),nearY:Math.max(t.y,n.y)}}function ne(e){if(!(e.maxTouchPoints>0))return!1;let t=/Android|iPhone|iPad|iPod|Mobile/i.test(e.userAgent),n=e.coarsePointer&&Math.min(e.width,e.height)<=1024;return t||n}function re(e){return e.maxTouchPoints<=0?!1:/iPhone|iPad|iPod/i.test(e.userAgent)||/Macintosh/i.test(e.userAgent)}function ie(){return ne({maxTouchPoints:navigator.maxTouchPoints,coarsePointer:window.matchMedia?.(`(pointer: coarse)`).matches??!1,userAgent:navigator.userAgent,width:window.innerWidth,height:window.innerHeight})}function ae(){return re({maxTouchPoints:navigator.maxTouchPoints,coarsePointer:window.matchMedia?.(`(pointer: coarse)`).matches??!1,userAgent:navigator.userAgent,width:window.innerWidth,height:window.innerHeight})}function oe(e,t,n){if(e<=0||t<=0||!Number.isFinite(e+t))return null;let r=Math.min(Number.isFinite(n)&&n>0?n:1,1.7,Math.sqrt(4e6/(e*t)));return{width:Math.max(1,Math.floor(e*r)),height:Math.max(1,Math.floor(t*r)),dpr:r}}async function z(e,t,n){let r=e.createShaderModule({label:t,code:n}),i=(await r.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(i.length)throw Error(`${t}: ${i.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);return r}var se=`
struct ShadowParams {
  light: vec4f,
  bed: vec4f,
}
struct Grain { position: vec4f, velocity: vec4f }
@group(0) @binding(0) var<uniform> params: ShadowParams;
@group(0) @binding(1) var<storage, read> grains: array<Grain>;

struct ShadowVertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) density: f32,
}

@vertex fn vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> ShadowVertexOutput {
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let grain = grains[instance];
  var output: ShadowVertexOutput;
  if (grain.position.w <= 0.0) {
    output.clip = vec4f(2.0, 2.0, 2.0, 1.0);
    output.local = vec2f(0.0);
    output.density = 0.0;
    return output;
  }

  let light = normalize(params.light.xyz);
  let height = max(0.0, grain.position.y - params.bed.x);
  let shadowCenter = grain.position.xz - light.xz * (height / max(light.y, 0.08));
  let physicalRadius = ${d.airborneGrainRadius} * pow(max(grain.position.w, 1e-9) / ${d.airborneReferenceMass}, 1.0 / 3.0);
  let sunPenumbra = height * 0.00471;
  let physicalFootprint = physicalRadius + sunPenumbra;
  let texel = params.bed.y / params.bed.z;
  let opticalRadius = max(physicalFootprint, texel * 0.90);
  let areaRatio = physicalFootprint * physicalFootprint / max(opticalRadius * opticalRadius, 1e-12);
  let density = min(0.26, areaRatio * 7.0);
  let offset = corners[vertex] * opticalRadius;
  let world = shadowCenter + offset;

  output.clip = vec4f(world.x / (params.bed.y * 0.5), world.y / (params.bed.y * 0.5), 0.0, 1.0);
  output.local = corners[vertex];
  output.density = density;
  return output;
}

@fragment fn fragment(input: ShadowVertexOutput) -> @location(0) vec4f {
  let squared = dot(input.local, input.local);
  if (squared > 1.0) { discard; }
  let profile = 1.0 - smoothstep(0.08, 1.0, squared);
  let opticalDepth = input.density * profile;
  return vec4f(opticalDepth, 0.0, 0.0, opticalDepth);
}
`,ce=class{texture;sampler;uniform;data=new Float32Array(8);pipeline;group;device;solver;constructor(e,t){this.device=e,this.solver=t,this.texture=e.createTexture({label:`Airborne sand optical depth`,size:[d.airborneShadowResolution,d.airborneShadowResolution],format:`rgba8unorm`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.sampler=e.createSampler({minFilter:`linear`,magFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),this.uniform=e.createBuffer({label:`Airborne shadow parameters`,size:this.data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}async initialize(){let e=await z(this.device,`Airborne sand shadow WGSL`,se);this.pipeline=await this.device.createRenderPipelineAsync({label:`Airborne sand optical-depth shadow`,layout:`auto`,vertex:{module:e,entryPoint:`vertex`},fragment:{module:e,entryPoint:`fragment`,targets:[{format:`rgba8unorm`,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`}}),this.group=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:this.solver.particles}}]})}encode(e,t){this.data.set([t[0],t[1],t[2],0,d.depth,d.extent,d.airborneShadowResolution,0]),this.device.queue.writeBuffer(this.uniform,0,this.data);let n=e.beginRenderPass({label:`Airborne sand shadow`,colorAttachments:[{view:this.texture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.pipeline),n.setBindGroup(0,this.group),n.draw(6,this.solver.particleCount),n.end()}clear(e){e.beginRenderPass({label:`Clear airborne sand shadow`,colorAttachments:[{view:this.texture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]}).end()}dispose(){this.texture.destroy(),this.uniform.destroy()}};function le(e){let t=Math.hypot(...e);return e.map(e=>e/t)}var ue=class{eye=[0,.52,.26];forward=le([0,d.depth-this.eye[1],-this.eye[2]]);right=[1,0,0];up=[0,-this.forward[2],this.forward[1]];distance=Math.hypot(this.eye[1]-d.depth,this.eye[2]);aspect=1;get tanHalfFov(){return .22/this.distance/Math.max(1,this.aspect)}screenToBed(e,t,n,r){let i=(2*e/n-1)*this.tanHalfFov*this.aspect,a=(1-2*t/r)*this.tanHalfFov,o=this.forward.map((e,t)=>e+i*this.right[t]+a*this.up[t]),s=(d.depth-this.eye[1])/o[1];return{x:this.eye[0]+o[0]*s,y:this.eye[2]+o[2]*s}}},B=Math.cos(-.8),V=.65,H=Math.sin(-.8),U=512,de=.82,fe=`
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
  @location(2) frondAnchorProgress: vec4f,
  @location(3) frondDirectionLeaf: vec4f,
}
struct VertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
}
fn smoothCurve(value: f32) -> f32 {
  let t = clamp(value, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
@vertex fn vertex(input: VertexInput) -> VertexOutput {
  let height = clamp(input.position.y, 0.0, 1.0);
  let phase = view.motion.x;

  // Keep the trunk base planted and bend its centerline progressively. The
  // crown follows this same low-frequency motion instead of translating as a
  // rigid object.
  let bend = height * height * (0.35 + 0.65 * height * height);
  let wind = vec2f(
    sin(phase * 0.46) + sin(phase * 0.19 + 1.7) * 0.34,
    cos(phase * 0.39 + 0.55) + sin(phase * 0.16 + 2.4) * 0.28
  );
  let trunkSway = wind * vec2f(0.019, 0.014) * bend;
  let trunkTwist = (sin(phase * 0.31 + height * 1.9) * 0.010 + sin(phase * 0.13 + 0.8) * 0.006) * bend;
  let twistCos = cos(trunkTwist);
  let twistSin = sin(trunkTwist);
  let trunkXZ = vec2f(
    input.position.x * twistCos - input.position.z * twistSin,
    input.position.x * twistSin + input.position.z * twistCos
  ) + trunkSway;
  var position = vec3f(trunkXZ.x, input.position.y, trunkXZ.y);

  // Each authored palm frond is a disconnected mesh island. CPU-side metadata
  // supplies its attachment point, direction, and normalized distance from the
  // attachment. This lets the shadow-only tree flex individual fronds while
  // keeping every vertex in one frond coherent.
  let leaf = input.frondDirectionLeaf.w;
  let progress = smoothCurve(input.frondAnchorProgress.w);
  let anchor = input.frondAnchorProgress.xyz;
  let frondDirection = input.frondDirectionLeaf.xyz;
  let horizontalLength = max(length(frondDirection.xz), 1e-4);
  let horizontalDirection = frondDirection.xz / horizontalLength;
  let sideways = vec2f(-horizontalDirection.y, horizontalDirection.x);
  let windLength = max(length(wind), 1e-4);
  let windDirection = wind / windLength;
  let windStrength = clamp(windLength, 0.35, 1.25);
  let windAlignment = dot(horizontalDirection, windDirection);
  let frondSeed = dot(frondDirection, vec3f(4.73, 7.19, 3.11));

  // Fronds lag the trunk slightly and flex most strongly toward their tips.
  // The shared gust term keeps the whole crown in sync; direction-derived
  // phase offsets stop all leaves from moving as a single rigid plate.
  let gust = sin(phase * 0.58 + frondSeed) * 0.70 + sin(phase * 0.27 + frondSeed * 0.61 + 1.2) * 0.30;
  let tipLag = sin(phase * 0.82 + frondSeed * 1.37 + progress * 2.2);
  let drag = windDirection * (0.0065 + 0.0045 * abs(windAlignment)) * windStrength * (0.72 + 0.28 * gust);
  let lateral = sideways * tipLag * 0.0045;
  let ripple = sideways * sin(phase * 1.12 + frondSeed * 1.91 + progress * 4.6) * 0.0018;
  let frondOffset = (drag + lateral + ripple) * progress * leaf;
  position = vec3f(position.x + frondOffset.x, position.y, position.z + frondOffset.y);

  // Small elevation changes are important in a projected shadow: they make a
  // frond visibly bow rather than merely slide sideways across the sand.
  let lift = (gust * 0.0060 * windStrength - windAlignment * 0.0035 * windStrength + tipLag * 0.0022) * progress * leaf;
  position = vec3f(position.x, position.y + lift, position.z);

  // Keep the root of every frond attached to the trunk's bent crown.
  let anchorHeight = clamp(anchor.y, 0.0, 1.0);
  let anchorBend = anchorHeight * anchorHeight * (0.35 + 0.65 * anchorHeight * anchorHeight);
  let anchorSway = wind * vec2f(0.019, 0.014) * anchorBend;
  let vertexSway = wind * vec2f(0.019, 0.014) * bend;
  let rootCorrection = (anchorSway - vertexSway) * (1.0 - progress) * leaf;
  position = vec3f(position.x + rootCorrection.x, position.y, position.z + rootCorrection.y);

  let projected = position.xz - vec2f(${B.toFixed(9)}, ${H.toFixed(9)}) * (position.y / ${V.toFixed(9)});
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
`,pe=`
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
`;function W(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}function me(e,t){let n=new Float32Array(16);for(let r=0;r<4;r++)for(let i=0;i<4;i++){let a=0;for(let n=0;n<4;n++)a+=e[n*4+i]*t[r*4+n];n[r*4+i]=a}return n}function he(e){if(e.matrix?.length===16)return new Float32Array(e.matrix);let t=W();return e.scale?.length===3&&(t[0]=e.scale[0],t[5]=e.scale[1],t[10]=e.scale[2]),e.translation?.length===3&&(t[12]=e.translation[0],t[13]=e.translation[1],t[14]=e.translation[2]),t}function ge(e,t,n,r){return[e[0]*t+e[4]*n+e[8]*r+e[12],e[1]*t+e[5]*n+e[9]*r+e[13],e[2]*t+e[6]*n+e[10]*r+e[14]]}function _e(e){if(e===`SCALAR`)return 1;if(e===`VEC2`)return 2;if(e===`VEC3`)return 3;if(e===`VEC4`)return 4;throw Error(`Unsupported glTF accessor type: ${e}`)}function ve(e){if(e===5126||e===5125)return 4;if(e===5123)return 2;throw Error(`Unsupported glTF component type: ${e}`)}function G(e,t,n){let r=e.accessors[n],i=e.bufferViews[r.bufferView],a=_e(r.type),o=ve(r.componentType),s=i.byteStride??a*o,c=(i.byteOffset??0)+(r.byteOffset??0),l=new DataView(t),u=new Float32Array(r.count*a);for(let e=0;e<r.count;e++)for(let t=0;t<a;t++){let n=c+e*s+t*o,i=r.componentType===5126?l.getFloat32(n,!0):r.componentType===5125?l.getUint32(n,!0):l.getUint16(n,!0);u[e*a+t]=i}return u}function ye(e,t,n){let r=G(e,t,n),i=new Uint32Array(r.length);for(let e=0;e<r.length;e++)i[e]=r[e];return i}function be(e,t){let n=e.length/3,r=new Uint32Array(n);for(let e=0;e<n;e++)r[e]=e;let i=e=>{let t=e;for(;r[t]!==t;)t=r[t];for(;r[e]!==e;){let n=r[e];r[e]=t,e=n}return t},a=(e,t)=>{let n=i(e),a=i(t);n!==a&&(r[a]=n)};for(let e=0;e<t.length;e+=3){let n=t[e],r=t[e+1],i=t[e+2];a(n,r),a(r,i),a(i,n)}let o=new Map;for(let e=0;e<n;e++){let t=i(e),n=o.get(t);n?n.push(e):o.set(t,[e])}let s=new Float32Array(n*8);for(let t of o.values()){let n=t[0],r=1/0;for(let i of t){let t=e[i*3],a=e[i*3+2],o=t*t+a*a;o<r&&(r=o,n=i)}let i=e[n*3],a=e[n*3+1],o=e[n*3+2],c=n,l=0;for(let n of t){let t=e[n*3]-i,r=e[n*3+1]-a,s=e[n*3+2]-o,u=t*t+r*r+s*s;u>l&&(l=u,c=n)}let u=e[c*3],d=e[c*3+1],f=e[c*3+2],p=Math.sqrt(l);if(!(a>.6&&p>.14))continue;let m=p>1e-6?1/p:0,h=(u-i)*m,g=(d-a)*m,_=(f-o)*m;for(let n of t){let t=e[n*3]-i,r=e[n*3+1]-a,c=e[n*3+2]-o,l=Math.min(1,Math.hypot(t,r,c)*m),u=n*8;s[u]=i,s[u+1]=a,s[u+2]=o,s[u+3]=l,s[u+4]=h,s[u+5]=g,s[u+6]=_,s[u+7]=1}}return s}function xe(e){let t=new DataView(e);if(t.getUint32(0,!0)!==1179937895||t.getUint32(4,!0)!==2)throw Error(`Coconut tree is not a valid glTF 2.0 binary.`);let n=12,r,i;for(;n<e.byteLength;){let a=t.getUint32(n,!0),o=t.getUint32(n+4,!0);n+=8;let s=e.slice(n,n+a);n+=a,o===1313821514&&(r=JSON.parse(new TextDecoder().decode(s))),o===5130562&&(i=s)}if(!r||!i)throw Error(`Coconut tree glTF is missing JSON or binary data.`);return{gltf:r,binary:i}}async function Se(){let e=await fetch(`/scene_assets/coconut_tree.glb`);if(!e.ok)throw Error(`Unable to load coconut tree (${e.status}).`);let{gltf:t,binary:n}=xe(await e.arrayBuffer()),r=t.nodes.map(()=>W()),i=(e,n)=>{let a=me(n,he(t.nodes[e]));r[e]=a;for(let n of t.nodes[e].children??[])i(n,a)};for(let e of t.scenes[t.scene].nodes)i(e,W());let a=[],o=1/0,s=1/0,c=1/0,l=-1/0,u=-1/0,d=-1/0;for(let[e,i]of t.nodes.entries()){if(i.mesh===void 0)continue;let f=t.meshes[i.mesh].primitives[0],p=G(t,n,f.attributes.POSITION),m=G(t,n,f.attributes.TEXCOORD_0),h=new Float32Array(p.length);for(let t=0;t<p.length;t+=3){let n=ge(r[e],p[t],p[t+1],p[t+2]);h[t]=n[0],h[t+1]=n[1],h[t+2]=n[2],o=Math.min(o,n[0]),s=Math.min(s,n[1]),c=Math.min(c,n[2]),l=Math.max(l,n[0]),u=Math.max(u,n[1]),d=Math.max(d,n[2])}a.push({positions:h,texcoords:m,indices:ye(t,n,f.indices)})}let f=Math.max(u-s,1e-6),p=(o+l)*.5,m=(c+d)*.5,h=a.map(e=>{let t=new Float32Array(e.positions.length);for(let n=0;n<e.positions.length;n+=3)t[n]=(e.positions[n]-p)/f,t[n+1]=(e.positions[n+1]-s)/f,t[n+2]=(e.positions[n+2]-m)/f;return{...e,positions:t,wind:be(t,e.indices)}}),g=1/0,_=1/0,v=-1/0,y=-1/0;for(let e of h)for(let t=0;t<e.positions.length;t+=3){let n=e.positions[t],r=e.positions[t+1],i=e.positions[t+2],a=n-B*r/V,o=i-H*r/V;g=Math.min(g,a),v=Math.max(v,a),_=Math.min(_,o),y=Math.max(y,o)}let b={x:(g+v)*.5,y:(_+y)*.5},x={x:(v-g)*.58,y:(y-_)*.58},S=t.images[0],C=t.bufferViews[S.bufferView],w=C.byteOffset??0;return{meshes:h,image:new Blob([n.slice(w,w+C.byteLength)],{type:S.mimeType}),projectedCenter:b,projectedHalfSize:x}}function Ce(e){let t=e.positions.length/3,n=new Float32Array(t*13),r=e.wind??new Float32Array(t*8);for(let i=0;i<t;i++){let t=i*13;n[t]=e.positions[i*3],n[t+1]=e.positions[i*3+1],n[t+2]=e.positions[i*3+2],n[t+3]=e.texcoords[i*2],n[t+4]=e.texcoords[i*2+1];for(let e=0;e<8;e++)n[t+5+e]=r[i*8+e]}return n}function we(e,t,n,r,i){let a=r?{x:.98,y:.04}:{x:.93,y:-.04},o=r?.88:.36,s=e(t*a.x,n*a.y),c=e(t*(a.x-o),n*a.y),l=e(t*(a.x+o),n*a.y),u=Math.abs(l.x-c.x)*.5,d=u/Math.max(i,.25);return{centerX:s.x,centerZ:s.y,halfWidth:u,halfHeight:d}}var Te=class{sampler;texture;device;shadowUniform;stabilizeUniform;shadowData=new Float32Array(8);stabilizeData=new Float32Array(4);shadowPipeline;stabilizePipeline;shadowGroup;stabilizeGroup;geometries=[];colorTexture;rawTexture;historyTexture;projectedCenter={x:0,y:0};projectedHalfSize={x:1,y:1};placement={centerX:.18,centerZ:-.1,halfWidth:.11,halfHeight:.11};hasHistory=!1;mobile=!1;constructor(e,t=!1){this.device=e,this.mobile=t,this.shadowUniform=e.createBuffer({label:`Coconut shadow view`,size:this.shadowData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.stabilizeUniform=e.createBuffer({label:`Coconut shadow stabilization`,size:this.stabilizeData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.texture=e.createTexture({label:`Coconut tree shadow`,size:[U,U],format:`rgba8unorm`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.rawTexture=e.createTexture({label:`Coconut tree shadow raw`,size:[U,U],format:`rgba8unorm`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.historyTexture=e.createTexture({label:`Coconut tree shadow history`,size:[U,U],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.sampler=e.createSampler({label:`Coconut tree shadow sampler`,magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`})}async initialize(){if(typeof window>`u`||typeof createImageBitmap!=`function`)return;let e=await Se();this.projectedCenter=e.projectedCenter,this.projectedHalfSize=e.projectedHalfSize;for(let t of e.meshes){let e=Ce(t),n=this.device.createBuffer({label:`Coconut shadow vertices`,size:e.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),r=this.device.createBuffer({label:`Coconut shadow indices`,size:t.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});this.device.queue.writeBuffer(n,0,e),this.device.queue.writeBuffer(r,0,t.indices),this.geometries.push({vertex:n,index:r,indexCount:t.indices.length})}let t=await createImageBitmap(e.image);this.colorTexture=this.device.createTexture({label:`Coconut alpha texture`,size:[t.width,t.height],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}),this.device.queue.copyExternalImageToTexture({source:t},{texture:this.colorTexture},[t.width,t.height]),t.close();let n=this.device.createSampler({label:`Coconut alpha sampler`,magFilter:`linear`,minFilter:`linear`,addressModeU:`repeat`,addressModeV:`repeat`}),r=this.device.createShaderModule({label:`Coconut shadow WGSL`,code:fe});this.shadowPipeline=await this.device.createRenderPipelineAsync({label:`Coconut shadow mask`,layout:`auto`,vertex:{module:r,entryPoint:`vertex`,buffers:[{arrayStride:52,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x2`},{shaderLocation:2,offset:20,format:`float32x4`},{shaderLocation:3,offset:36,format:`float32x4`}]}]},fragment:{module:r,entryPoint:`fragment`,targets:[{format:`rgba8unorm`,blend:{color:{operation:`max`,srcFactor:`one`,dstFactor:`one`},alpha:{operation:`max`,srcFactor:`one`,dstFactor:`one`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),this.shadowGroup=this.device.createBindGroup({layout:this.shadowPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.shadowUniform}},{binding:1,resource:n},{binding:2,resource:this.colorTexture.createView()}]});let i=this.device.createShaderModule({label:`Coconut shadow stabilize WGSL`,code:pe});this.stabilizePipeline=await this.device.createRenderPipelineAsync({label:`Coconut shadow stabilize`,layout:`auto`,vertex:{module:i,entryPoint:`vertex`},fragment:{module:i,entryPoint:`fragment`,targets:[{format:`rgba8unorm`}]},primitive:{topology:`triangle-list`}}),this.stabilizeGroup=this.device.createBindGroup({layout:this.stabilizePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.rawTexture.createView()},{binding:2,resource:this.historyTexture.createView()},{binding:3,resource:{buffer:this.stabilizeUniform}}]})}resize(e,t,n){let r=this.projectedHalfSize.x/Math.max(this.projectedHalfSize.y,1e-4);this.placement=we(n,e,t,this.mobile,r)}encode(e,t){if(!this.shadowPipeline||!this.stabilizePipeline)return;this.shadowData.set([this.projectedCenter.x,this.projectedCenter.y,this.projectedHalfSize.x,this.projectedHalfSize.y,t*.001,0,0,0]),this.stabilizeData.set([1/U,1/U,+!!this.hasHistory,0]),this.device.queue.writeBuffer(this.shadowUniform,0,this.shadowData),this.device.queue.writeBuffer(this.stabilizeUniform,0,this.stabilizeData);let n=e.beginRenderPass({label:`Coconut tree shadow raw`,colorAttachments:[{view:this.rawTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.shadowPipeline),n.setBindGroup(0,this.shadowGroup);for(let e of this.geometries)n.setVertexBuffer(0,e.vertex),n.setIndexBuffer(e.index,`uint32`),n.drawIndexed(e.indexCount);n.end();let r=e.beginRenderPass({label:`Coconut tree shadow stabilize`,colorAttachments:[{view:this.texture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});r.setPipeline(this.stabilizePipeline),r.setBindGroup(0,this.stabilizeGroup),r.draw(3),r.end(),e.copyTextureToTexture({texture:this.texture},{texture:this.historyTexture},{width:U,height:U}),this.hasHistory=!0}get centerX(){return this.placement.centerX}get centerZ(){return this.placement.centerZ}get halfWidth(){return this.placement.halfWidth}get halfHeight(){return this.placement.halfHeight}get opacity(){return de}dispose(){for(let e of this.geometries)e.vertex.destroy(),e.index.destroy();this.colorTexture?.destroy(),this.rawTexture.destroy(),this.historyTexture.destroy(),this.texture.destroy(),this.shadowUniform.destroy(),this.stabilizeUniform.destroy()}},Ee=`
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
`,De=class{buffer;pipeline;groups=[];revision=-1;angle=NaN;device;solver;uniform;constructor(e,t,n){this.device=e,this.solver=t,this.uniform=n,this.buffer=e.createBuffer({label:`Bed-space illumination`,size:t.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})}async initialize(){let e=await z(this.device,`Bed horizon lighting WGSL`,Ee);this.pipeline=await this.device.createComputePipelineAsync({layout:`auto`,compute:{module:e,entryPoint:`illuminate`}}),this.groups=this.solver.buffers.map(e=>this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:e}},{binding:2,resource:{buffer:this.buffer}}]}))}encode(e,t){if(this.revision===this.solver.revision&&this.angle===t)return;let n=e.beginComputePass({label:`Bed horizon lighting`});n.setPipeline(this.pipeline),n.setBindGroup(0,this.groups[this.solver.stateIndex]),n.dispatchWorkgroups(Math.ceil(this.solver.resolution/8),Math.ceil(this.solver.resolution/8)),n.end(),this.revision=this.solver.revision,this.angle=t}dispose(){this.buffer.destroy()}},K=`
const WAVE_SHORELINE_TILT = ${w.shorelineTilt};
const WAVE_SHORELINE_AMPLITUDE = ${w.shorelineAmplitude};
const WAVE_SHORELINE_FREQUENCY_A = ${w.shorelineFrequencyA};
const WAVE_SHORELINE_FREQUENCY_B = ${w.shorelineFrequencyB};
const WAVE_SHORELINE_FREQUENCY_C = ${w.shorelineFrequencyC};
const WAVE_SHORELINE_SPEED_A = ${w.shorelineSpeedA};
const WAVE_SHORELINE_SPEED_B = ${w.shorelineSpeedB};
const WAVE_SHORELINE_SPEED_C = ${w.shorelineSpeedC};
const WAVE_SHORELINE_BLEND = ${w.shorelineBlend};

fn shorelineOffset(x: f32, time: f32) -> f32 {
  let breakerA = sin(x * WAVE_SHORELINE_FREQUENCY_A + time * WAVE_SHORELINE_SPEED_A);
  let breakerB = sin(x * WAVE_SHORELINE_FREQUENCY_B + time * WAVE_SHORELINE_SPEED_B + 1.7);
  let breakerC = sin(x * WAVE_SHORELINE_FREQUENCY_C - time * WAVE_SHORELINE_SPEED_C + 0.6);
  return x * WAVE_SHORELINE_TILT
    + WAVE_SHORELINE_AMPLITUDE * (breakerA + breakerB * WAVE_SHORELINE_BLEND)
    + WAVE_SHORELINE_AMPLITUDE * 0.55 * breakerC;
}

fn shorelineFront(x: f32, baseFront: f32, time: f32) -> f32 {
  return baseFront + shorelineOffset(x, time);
}
`,q=d.resolution,J=`rgba16float`,Y=`r16float`,Oe=d.extent/q,X=`
${K}
struct OverlayView {
  eye: vec4f,
  forward: vec4f,
  right: vec4f,
  up: vec4f,
  waveFront: vec4f,
  waveShape: vec4f,
  waveLook: vec4f,
}
struct WaveSample {
  height: f32,
  slope: vec2f,
  displacement: vec2f,
}
struct VertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,
}
@group(0) @binding(0) var<uniform> overlay: OverlayView;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let clip = positions[index];
  var output: VertexOutput;
  output.clip = vec4f(clip, 0.0, 1.0);
  output.uv = clip * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}
fn hash21(point: vec2f) -> f32 {
  let p3 = fract(vec3f(point.x, point.y, point.x) * vec3f(0.1031, 0.1030, 0.0973));
  let q = p3 + dot(p3, p3.yzx + vec3f(33.33));
  return fract((q.x + q.y) * q.z);
}
fn valueNoise(point: vec2f) -> f32 {
  let cell = floor(point);
  let blend = fract(point);
  let curve = blend * blend * (3.0 - 2.0 * blend);
  let a = hash21(cell);
  let b = hash21(cell + vec2f(1.0, 0.0));
  let c = hash21(cell + vec2f(0.0, 1.0));
  let d = hash21(cell + vec2f(1.0, 1.0));
  return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
}
fn fbm(point: vec2f) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var position = point;
  for (var octave = 0; octave < 4; octave++) {
    value += valueNoise(position) * amplitude;
    position = mat2x2f(1.72, 1.14, -1.14, 1.72) * position + vec2f(13.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}
fn fieldUv(point: vec2f) -> vec2f {
  let halfExtent = max(overlay.waveFront.w, 0.0001);
  return clamp(point / (halfExtent * 2.0) + vec2f(0.5), vec2f(0.001), vec2f(0.999));
}
fn fieldWorld(uv: vec2f) -> vec2f {
  let halfExtent = overlay.waveFront.w;
  return (uv * 2.0 - vec2f(1.0)) * halfExtent;
}
fn filmDepth(waterDistance: f32) -> f32 {
  let entry = smoothstep(-overlay.waveShape.x * 0.08, overlay.waveShape.x * 1.25, waterDistance);
  let body = smoothstep(overlay.waveShape.x * 0.25, 0.17, waterDistance);
  return entry * mix(0.0010, 0.034, body);
}
fn frontCrest(waterDistance: f32) -> f32 {
  let center = overlay.waveShape.y * 0.46;
  let width = max(overlay.waveShape.y * 0.70, 0.008);
  let coordinate = (waterDistance - center) / width;
  return exp(-coordinate * coordinate * 2.2) * 0.0044;
}
`,ke=`
${X}
struct FieldOutput {
  @location(0) surface: vec4f,
  @location(1) motion: vec4f,
}
fn packetEnvelope(point: vec2f, direction: vec2f, envelopeScale: f32, seed: f32, time: f32) -> f32 {
  let cross = vec2f(-direction.y, direction.x);
  let along = dot(point, direction) / envelopeScale;
  let across = dot(point, cross) / (envelopeScale * 0.82);
  let broad = fbm(vec2f(along * 0.55 + seed * 3.7 + time * 0.013, across * 0.62 - seed * 2.9));
  let detail = fbm(vec2f(along * 1.45 - seed * 5.3 - time * 0.018, across * 1.18 + seed * 4.1));
  let density = broad * 0.72 + detail * 0.28;
  return mix(0.74, 1.34, smoothstep(0.24, 0.82, density));
}
fn gerstnerPacket(
  point: vec2f,
  directionRaw: vec2f,
  wavelength: f32,
  amplitude: f32,
  speed: f32,
  steepness: f32,
  phaseOffset: f32,
  envelopeScale: f32,
  time: f32
) -> WaveSample {
  let direction = normalize(directionRaw);
  let cross = vec2f(-direction.y, direction.x);
  let envelope = packetEnvelope(point, direction, envelopeScale, phaseOffset, time * speed);
  let warp = vec2f(
    fbm(point * (0.52 / envelopeScale) + vec2f(phaseOffset * 2.1, -time * 0.022)),
    fbm(point * (0.47 / envelopeScale) + vec2f(-phaseOffset * 1.3, time * 0.018))
  ) - vec2f(0.5);
  let warpedPoint = point + warp * (wavelength * 0.26);
  let along = dot(warpedPoint, direction);
  let across = dot(warpedPoint, cross);
  let wavenumber = 6.28318530718 / wavelength;
  let sideband = sin(across * wavenumber * 0.38 + phaseOffset * 1.7) * 0.36;
  let phase = along * wavenumber - time * speed * wavenumber + phaseOffset + sideband;
  let sinePhase = sin(phase);
  let cosinePhase = cos(phase);
  let harmonic2 = sin(phase * 2.0 + 0.45);
  let harmonic3 = sin(phase * 3.0 - 1.10);
  let harmonic2d = cos(phase * 2.0 + 0.45);
  let harmonic3d = cos(phase * 3.0 - 1.10);
  let shapedAmplitude = amplitude * envelope;
  let height = shapedAmplitude * (sinePhase + harmonic2 * 0.18 + harmonic3 * 0.07);
  let slopeAlong = shapedAmplitude * wavenumber * (cosinePhase + harmonic2d * 0.36 + harmonic3d * 0.21);
  let slopeAcross = shapedAmplitude * wavenumber * 0.18 * cos(across * wavenumber * 0.65 + phaseOffset * 1.9);
  let displacement = direction * (shapedAmplitude * steepness * (cosinePhase + harmonic2d * 0.18)) * mix(0.78, 1.22, envelope - 0.74);
  return WaveSample(height, direction * slopeAlong + cross * slopeAcross, displacement);
}
fn waveField(point: vec2f, waterDistance: f32, time: f32) -> WaveSample {
  let shoreGain = mix(1.72, 0.84, smoothstep(-0.01, 0.20, waterDistance));
  let bodyGain = mix(1.0, 0.88, smoothstep(0.04, 0.20, waterDistance));
  let rippleGain = mix(0.96, 1.15, clamp(overlay.waveLook.z / 24.0, 0.75, 1.45));
  let drift = max(overlay.waveLook.w, 0.05) / 0.48;
  let coastWarp = vec2f(
    fbm(point * 0.85 + vec2f(time * 0.018, -time * 0.011)),
    fbm(point * 0.79 + vec2f(-time * 0.014, time * 0.016))
  ) - vec2f(0.5);
  let drivenPoint = point + coastWarp * vec2f(0.030, 0.042);

  let g0 = gerstnerPacket(drivenPoint, vec2f(0.10, -1.0), 0.340, 0.00185 * shoreGain, 0.55 * drift, 0.74, 0.0, 0.82, time);
  let g1 = gerstnerPacket(drivenPoint, vec2f(-0.22, -0.98), 0.235, 0.00135 * shoreGain, 0.50 * drift, 0.69, 1.7, 0.58, time);
  let g2 = gerstnerPacket(drivenPoint, vec2f(0.31, -0.95), 0.168, 0.00100 * shoreGain, 0.44 * drift, 0.63, 2.9, 0.42, time);
  let g3 = gerstnerPacket(drivenPoint, vec2f(0.83, -0.56), 0.112, 0.00064 * bodyGain, 0.38 * drift, 0.55, 4.4, 0.34, time);
  let c0 = gerstnerPacket(drivenPoint, vec2f(0.93, 0.38), 0.076, 0.00034 * rippleGain, 0.34 * drift, 0.34, 5.2, 0.24, time);
  let c1 = gerstnerPacket(drivenPoint, vec2f(0.70, -0.72), 0.061, 0.00028 * rippleGain, 0.31 * drift, 0.31, 2.4, 0.20, time);
  let c2 = gerstnerPacket(drivenPoint, vec2f(-0.13, 0.99), 0.050, 0.00022 * rippleGain, 0.29 * drift, 0.29, 4.5, 0.17, time);
  let c3 = gerstnerPacket(drivenPoint, vec2f(-0.83, 0.56), 0.041, 0.00017 * rippleGain, 0.26 * drift, 0.27, 0.9, 0.14, time);
  let c4 = gerstnerPacket(drivenPoint, vec2f(-0.55, -0.84), 0.034, 0.00013 * rippleGain, 0.24 * drift, 0.24, 2.9, 0.12, time);

  return WaveSample(
    g0.height + g1.height + g2.height + g3.height + c0.height + c1.height + c2.height + c3.height + c4.height,
    g0.slope + g1.slope + g2.slope + g3.slope + c0.slope + c1.slope + c2.slope + c3.slope + c4.slope,
    g0.displacement + g1.displacement + g2.displacement + g3.displacement + c0.displacement + c1.displacement + c2.displacement + c3.displacement + c4.displacement
  );
}
fn foamCoverage(point: vec2f, waterDistance: f32, time: f32) -> f32 {
  let foamReach = max(overlay.waveShape.y * 1.6, overlay.waveShape.z * 2.55);
  if (waterDistance < -overlay.waveShape.y * 1.1 || waterDistance > foamReach) { return 0.0; }
  let advect = vec2f(time * 0.19, -time * 0.58);
  let broadBreakup = fbm(point * 11.0 + advect) - 0.5;
  let fineBreakup = fbm(point * 27.0 + vec2f(-time * 0.44, time * 0.21)) - 0.5;
  let warpedDistance = waterDistance + (broadBreakup * 0.78 + fineBreakup * 0.22) * overlay.waveShape.y * 0.92;
  let frontCenter = overlay.waveShape.y * 0.20;
  let frontBand = 1.0 - smoothstep(overlay.waveShape.y * 0.18, overlay.waveShape.y * 1.08, abs(warpedDistance - frontCenter));
  let trail = smoothstep(0.0, overlay.waveShape.z * 0.30, warpedDistance)
    * (1.0 - smoothstep(overlay.waveShape.z * 0.56, overlay.waveShape.z * 2.45, warpedDistance));
  let frothA = smoothstep(0.47, 0.74, fbm(point * 19.0 + vec2f(time * 0.26, -time * 0.39)));
  let frothB = smoothstep(0.50, 0.78, fbm(point * 38.0 + vec2f(-time * 0.63, time * 0.31)));
  let stringers = smoothstep(0.58, 0.80, fbm(vec2f(point.x * 10.0, point.y * 26.0) + vec2f(time * 0.10, -time * 0.72)));
  let micro = smoothstep(0.78, 0.92, valueNoise(point * 121.0 + advect * 4.2));
  let frontFroth = frontBand * (0.56 + frothA * 0.32 + frothB * 0.20);
  let trailingFroth = trail * (frothA * 0.36 + frothB * 0.24 + stringers * 0.22 + micro * 0.08);
  return clamp(frontFroth + trailingFroth, 0.0, 1.0);
}
@fragment fn fragment(input: VertexOutput) -> FieldOutput {
  let point = fieldWorld(input.uv);
  let waterDistance = point.y - shorelineFront(point.x, overlay.waveFront.y, overlay.waveFront.z);
  var output: FieldOutput;
  if (waterDistance < -overlay.waveShape.x * 3.0) {
    output.surface = vec4f(0.0);
    output.motion = vec4f(0.0);
    return output;
  }
  let wave = waveField(point, waterDistance, overlay.waveFront.z);
  let foam = foamCoverage(point, waterDistance, overlay.waveFront.z);
  output.surface = vec4f(wave.height, wave.slope, foam);
  output.motion = vec4f(wave.displacement, 0.0, 0.0);
  return output;
}
`,Ae=`
${X}
@group(0) @binding(1) var fieldSampler: sampler;
@group(0) @binding(2) var surfaceField: texture_2d<f32>;
@group(0) @binding(3) var motionField: texture_2d<f32>;
fn sampleWave(point: vec2f) -> WaveSample {
  let uv = fieldUv(point);
  let surface = textureSampleLevel(surfaceField, fieldSampler, uv, 0.0);
  let motion = textureSampleLevel(motionField, fieldSampler, uv, 0.0);
  return WaveSample(surface.r, surface.gb, motion.rg);
}
fn waterSurface(point: vec2f, time: f32, wave: WaveSample) -> vec4f {
  let waterDistance = point.y - shorelineFront(point.x, overlay.waveFront.y, time);
  let depth = filmDepth(waterDistance);
  let crest = frontCrest(waterDistance);
  let surfaceHeight = ${d.depth} + max(0.0007, depth + crest + wave.height);
  let frontScale = max(overlay.waveShape.y * 1.35, 0.012);
  let frontInfluence = exp(-pow((waterDistance - overlay.waveShape.y * 0.30) / frontScale, 2.0));
  let frontSlope = 0.085 * frontInfluence;
  let slope = wave.slope + vec2f(0.0, frontSlope);
  return vec4f(normalize(vec3f(-slope.x, 1.0, -slope.y)), surfaceHeight);
}
fn flatLightLanding(surfacePoint: vec2f, time: f32, sunDirection: vec3f) -> vec2f {
  let waterDistance = surfacePoint.y - shorelineFront(surfacePoint.x, overlay.waveFront.y, time);
  let depth = filmDepth(waterDistance) + frontCrest(waterDistance);
  let originY = ${d.depth} + max(depth, 0.0007);
  let transmitted = refract(-sunDirection, vec3f(0.0, 1.0, 0.0), 1.0 / 1.333);
  let distance = (${d.depth} - originY) / min(transmitted.y, -0.0001);
  return surfacePoint + transmitted.xz * max(distance, 0.0);
}
fn waveLightLanding(surfacePoint: vec2f, time: f32, sunDirection: vec3f) -> vec2f {
  let wave = sampleWave(surfacePoint);
  let surface = waterSurface(surfacePoint, time, wave);
  let transmitted = refract(-sunDirection, surface.xyz, 1.0 / 1.333);
  let distance = (${d.depth} - surface.w) / min(transmitted.y, -0.0001);
  return surfacePoint + wave.displacement + transmitted.xz * max(distance, 0.0);
}
fn inverseLightSurface(bedPoint: vec2f, time: f32, sunDirection: vec3f) -> vec2f {
  var surfacePoint = bedPoint;
  for (var iteration = 0; iteration < 2; iteration++) {
    let landed = waveLightLanding(surfacePoint, time, sunDirection);
    surfacePoint -= (landed - bedPoint) * 0.92;
  }
  return surfacePoint;
}
fn differentialCaustic(bedPoint: vec2f, time: f32, sunDirection: vec3f) -> f32 {
  let surfacePoint = inverseLightSurface(bedPoint, time, sunDirection);
  let epsilon = ${Oe.toFixed(9)};
  let dx = vec2f(epsilon, 0.0);
  let dz = vec2f(0.0, epsilon);
  let newCenter = waveLightLanding(surfacePoint, time, sunDirection);
  let newDx = waveLightLanding(surfacePoint + dx, time, sunDirection) - newCenter;
  let newDz = waveLightLanding(surfacePoint + dz, time, sunDirection) - newCenter;
  let oldCenter = flatLightLanding(surfacePoint, time, sunDirection);
  let oldDx = flatLightLanding(surfacePoint + dx, time, sunDirection) - oldCenter;
  let oldDz = flatLightLanding(surfacePoint + dz, time, sunDirection) - oldCenter;
  let oldArea = abs(oldDx.x * oldDz.y - oldDx.y * oldDz.x);
  let newArea = max(abs(newDx.x * newDz.y - newDx.y * newDz.x), oldArea * 0.10);
  let concentration = clamp(oldArea / max(newArea, 1e-8), 0.30, 8.0);
  let waterDistance = surfacePoint.y - shorelineFront(surfacePoint.x, overlay.waveFront.y, time);
  let depth = filmDepth(waterDistance) + frontCrest(waterDistance);
  let visibleDepth = smoothstep(0.002, 0.008, depth) * (1.0 - smoothstep(0.040, 0.075, depth));
  return mix(1.0, pow(concentration, 1.18), visibleDepth);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) f32 {
  let bedPoint = fieldWorld(input.uv);
  let waterDistance = bedPoint.y - shorelineFront(bedPoint.x, overlay.waveFront.y, overlay.waveFront.z);
  if (waterDistance < -overlay.waveShape.x * 0.20) { return 1.0; }
  let sunDirection = normalize(vec3f(0.6967067, 0.65, -0.7173561));
  return differentialCaustic(bedPoint, overlay.waveFront.z, sunDirection);
}
`,je=`
${X}
struct SurfaceHit {
  position: vec3f,
  normal: vec3f,
  waterDistance: f32,
}
@group(0) @binding(1) var postSampler: sampler;
@group(0) @binding(2) var sourceTexture: texture_2d<f32>;
@group(0) @binding(3) var surfaceField: texture_2d<f32>;
@group(0) @binding(4) var causticFieldTexture: texture_2d<f32>;
fn toLinear(color: vec3f) -> vec3f {
  let low = color / 12.92;
  let high = pow(max((color + 0.055) / 1.055, vec3f(0.0)), vec3f(2.4));
  return select(low, high, color > vec3f(0.04045));
}
fn toSrgb(color: vec3f) -> vec3f {
  let safe = max(color, vec3f(0.0));
  let low = safe * 12.92;
  let high = 1.055 * pow(safe, vec3f(1.0 / 2.4)) - 0.055;
  return select(low, high, safe > vec3f(0.0031308));
}
fn viewRay(uv: vec2f) -> vec3f {
  let screen = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  return normalize(
    overlay.forward.xyz
    + screen.x * overlay.eye.w * overlay.forward.w * overlay.right.xyz
    + screen.y * overlay.eye.w * overlay.up.xyz
  );
}
fn intersectBed(uv: vec2f) -> vec4f {
  let direction = viewRay(uv);
  let distance = (${d.depth} - overlay.eye.y) / direction.y;
  let world = overlay.eye.xyz + direction * distance;
  return vec4f(world.x, world.z, distance, select(0.0, 1.0, distance > 0.0));
}
fn projectWorld(world: vec3f) -> vec2f {
  let relative = world - overlay.eye.xyz;
  let forwardDistance = max(dot(relative, overlay.forward.xyz), 0.0001);
  let horizontal = dot(relative, overlay.right.xyz) / (forwardDistance * overlay.eye.w * overlay.forward.w);
  let vertical = dot(relative, overlay.up.xyz) / (forwardDistance * overlay.eye.w);
  return vec2f(horizontal * 0.5 + 0.5, 0.5 - vertical * 0.5);
}
fn sampleSurface(point: vec2f) -> vec4f {
  return textureSampleLevel(surfaceField, postSampler, fieldUv(point), 0.0);
}
fn waterSurface(point: vec2f, waterDistance: f32) -> vec4f {
  let wave = sampleSurface(point);
  let depth = filmDepth(waterDistance);
  let crest = frontCrest(waterDistance);
  let surfaceHeight = ${d.depth} + max(0.0007, depth + crest + wave.r);
  let frontScale = max(overlay.waveShape.y * 1.35, 0.012);
  let frontInfluence = exp(-pow((waterDistance - overlay.waveShape.y * 0.30) / frontScale, 2.0));
  let frontSlope = 0.085 * frontInfluence;
  let slope = wave.gb + vec2f(0.0, frontSlope);
  return vec4f(normalize(vec3f(-slope.x, 1.0, -slope.y)), surfaceHeight);
}
fn solveSurface(uv: vec2f, time: f32) -> SurfaceHit {
  let direction = viewRay(uv);
  var distance = (${d.depth} - overlay.eye.y) / direction.y;
  var position = overlay.eye.xyz + direction * distance;
  var waterDistance = position.z - shorelineFront(position.x, overlay.waveFront.y, time);
  var surface = waterSurface(position.xz, waterDistance);
  for (var iteration = 0; iteration < 3; iteration++) {
    distance = (surface.w - overlay.eye.y) / direction.y;
    position = overlay.eye.xyz + direction * distance;
    waterDistance = position.z - shorelineFront(position.x, overlay.waveFront.y, time);
    surface = waterSurface(position.xz, waterDistance);
  }
  position = overlay.eye.xyz + direction * ((surface.w - overlay.eye.y) / direction.y);
  waterDistance = position.z - shorelineFront(position.x, overlay.waveFront.y, time);
  surface = waterSurface(position.xz, waterDistance);
  return SurfaceHit(vec3f(position.x, surface.w, position.z), surface.xyz, waterDistance);
}
fn cloudMask(directionRaw: vec3f, time: f32) -> f32 {
  let direction = normalize(directionRaw);
  if (direction.y <= 0.018) { return 0.0; }
  var uv = direction.xz / max(direction.y, 0.055);
  uv = uv * 0.40 + vec2f(time * 0.0048, -time * 0.0027);
  let broad = valueNoise(uv * 0.78);
  let detail = valueNoise(uv * 2.05 + vec2f(12.7, -8.3));
  let wisps = valueNoise(uv * 4.3 + vec2f(-4.1, 9.6));
  let density = broad * 0.62 + detail * 0.28 + wisps * 0.10;
  return smoothstep(0.49, 0.68, density) * smoothstep(0.025, 0.24, direction.y);
}
fn skyRadiance(directionRaw: vec3f, sunDirection: vec3f, time: f32) -> vec3f {
  let direction = normalize(directionRaw);
  let upward = clamp(direction.y, -1.0, 1.0);
  let horizon = vec3f(0.74, 0.89, 1.06);
  let zenith = vec3f(0.12, 0.40, 0.90);
  let below = vec3f(0.035, 0.085, 0.10);
  var color = select(
    mix(horizon, below, clamp(-upward * 3.0, 0.0, 1.0)),
    mix(horizon, zenith, pow(max(upward, 0.0), 0.46)),
    upward >= 0.0
  );
  let cloud = cloudMask(direction, time);
  let sunAmount = max(dot(direction, sunDirection), 0.0);
  let cloudLight = mix(vec3f(0.72, 0.80, 0.90), vec3f(1.30, 1.18, 1.02), 0.55 + 0.45 * sunAmount);
  color = mix(color, cloudLight, cloud * 0.82);
  let innerAureole = pow(sunAmount, 420.0) * 1.8;
  let outerAureole = pow(sunAmount, 28.0) * 0.20;
  color += vec3f(1.0, 0.86, 0.64) * (innerAureole + outerAureole) * (1.0 - cloud * 0.62);
  return color;
}
fn fresnelDielectric(cosineIncident: f32, etaIncident: f32, etaTransmitted: f32) -> f32 {
  let cosI = clamp(cosineIncident, 0.0, 1.0);
  let eta = etaIncident / etaTransmitted;
  let sinT2 = eta * eta * max(0.0, 1.0 - cosI * cosI);
  if (sinT2 >= 1.0) { return 1.0; }
  let cosT = sqrt(max(0.0, 1.0 - sinT2));
  let rsNumerator = etaIncident * cosI - etaTransmitted * cosT;
  let rsDenominator = etaIncident * cosI + etaTransmitted * cosT;
  let rpNumerator = etaTransmitted * cosI - etaIncident * cosT;
  let rpDenominator = etaTransmitted * cosI + etaIncident * cosT;
  let rs = rsNumerator / max(abs(rsDenominator), 0.00001);
  let rp = rpNumerator / max(abs(rpDenominator), 0.00001);
  return clamp(0.5 * (rs * rs + rp * rp), 0.0, 1.0);
}
fn ggxDistribution(noH: f32, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;
  let denominator = noH * noH * (alpha2 - 1.0) + 1.0;
  return alpha2 / max(3.14159265 * denominator * denominator, 0.0001);
}
fn smithVisibility(noV: f32, noL: f32, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let k = alpha * 0.5;
  let gv = noV / max(noV * (1.0 - k) + k, 0.0001);
  let gl = noL / max(noL * (1.0 - k) + k, 0.0001);
  return gv * gl;
}
fn refractedBedWorld(surface: SurfaceHit, incident: vec3f, eta: f32) -> vec3f {
  let transmitted = refract(incident, surface.normal, eta);
  let distance = (${d.depth} - surface.position.y) / min(transmitted.y, -0.0001);
  return surface.position + transmitted * max(distance, 0.0);
}
fn edgeSafeRefractionUv(sampleUv: vec2f, dimensions: vec2f) -> vec2f {
  let halfTexel = vec2f(0.5) / dimensions;
  let span = max(vec2f(1.0) - halfTexel * 2.0, vec2f(1e-6));
  let normalized = (sampleUv - halfTexel) / span;
  // Mirror the finite scene color at the framebuffer boundary. This preserves
  // refractive motion all the way to the screen edge without ever collapsing
  // an out-of-range footprint onto one clamped row/column.
  let mirrored = vec2f(1.0) - abs(fract(normalized * 0.5) * 2.0 - vec2f(1.0));
  return halfTexel + mirrored * span;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let source = textureSampleLevel(sourceTexture, postSampler, input.uv, 0.0);
  let bed = intersectBed(input.uv);
  if (bed.w < 0.5) { return source; }

  let shoreline = shorelineFront(bed.x, overlay.waveFront.y, overlay.waveFront.z);
  let waterDistance = bed.y - shoreline;
  let waterMask = smoothstep(-overlay.waveShape.x * ${w.waterMaskBackstep}, overlay.waveShape.x, waterDistance);
  if (waterMask <= 0.0001) { return source; }

  let incident = viewRay(input.uv);
  let surface = solveSurface(input.uv, overlay.waveFront.z);
  let viewDirection = normalize(-incident);
  let noV = max(dot(surface.normal, viewDirection), 0.001);
  let sunDirection = normalize(vec3f(0.6967067, 0.65, -0.7173561));

  let reflectedDirection = reflect(incident, surface.normal);
  let fresnel = fresnelDielectric(noV, 1.0, 1.333);
  let reflection = skyRadiance(reflectedDirection, sunDirection, overlay.waveFront.z) * 2.15;

  let bedRed = refractedBedWorld(surface, incident, 1.0 / 1.3310);
  let bedGreen = refractedBedWorld(surface, incident, 1.0 / 1.3330);
  let bedBlue = refractedBedWorld(surface, incident, 1.0 / 1.3370);
  let projectedRed = projectWorld(bedRed);
  let projectedGreen = projectWorld(bedGreen);
  let projectedBlue = projectWorld(bedBlue);
  let sourceDimensions = max(vec2f(textureDimensions(sourceTexture, 0)), vec2f(1.0));
  let redSample = textureSampleLevel(sourceTexture, postSampler, edgeSafeRefractionUv(projectedRed, sourceDimensions), 0.0).rgb;
  let greenSample = textureSampleLevel(sourceTexture, postSampler, edgeSafeRefractionUv(projectedGreen, sourceDimensions), 0.0).rgb;
  let blueSample = textureSampleLevel(sourceTexture, postSampler, edgeSafeRefractionUv(projectedBlue, sourceDimensions), 0.0).rgb;
  let refractedSrgb = vec3f(redSample.r, greenSample.g, blueSample.b);
  var refractedBed = toLinear(refractedSrgb);

  let transmittedRay = refract(incident, surface.normal, 1.0 / 1.333);
  let pathLength = max((surface.position.y - ${d.depth}) / max(abs(transmittedRay.y), 0.06), 0.0);
  let causticField = textureSampleLevel(causticFieldTexture, postSampler, fieldUv(bedGreen.xz), 0.0).r;
  let causticPositive = max(causticField - 1.0, 0.0);
  let causticNegative = max(1.0 - causticField, 0.0);
  let causticLace = smoothstep(1.02, 1.16, causticField) * pow(clamp(causticPositive * 0.95, 0.0, 6.0), 1.10);
  let causticDepth = smoothstep(0.003, 0.010, pathLength) * (1.0 - smoothstep(0.038, 0.075, pathLength));
  let causticGain = 1.0 + causticPositive * 0.26 - causticNegative * 0.08;
  refractedBed *= vec3f(causticGain * 1.040, causticGain * 1.020, causticGain * 0.992);

  let extinction = vec3f(0.34, 0.075, 0.030) * mix(0.84, 1.16, overlay.waveLook.x);
  let transmittance = exp(-extinction * pathLength);
  let scatterColor = vec3f(0.018, 0.115, 0.17) * mix(0.68, 1.14, overlay.waveLook.x);
  var transmission = refractedBed * transmittance + scatterColor * (vec3f(1.0) - transmittance);
  let causticColor = vec3f(1.0, 0.97, 0.86) * 0.20 + vec3f(0.84, 0.94, 1.0) * 0.05;
  transmission += causticColor * (causticLace * causticDepth);

  let halfVector = normalize(viewDirection + sunDirection);
  let noL = max(dot(surface.normal, sunDirection), 0.0);
  let noH = max(dot(surface.normal, halfVector), 0.0);
  let voH = max(dot(viewDirection, halfVector), 0.0);
  let roughness = mix(0.055, 0.024, clamp(overlay.waveLook.y, 0.0, 1.0));
  let microFresnel = fresnelDielectric(voH, 1.0, 1.333);
  let specularBrdf = ggxDistribution(noH, roughness) * smithVisibility(noV, noL, roughness) * microFresnel
    / max(4.0 * noV * max(noL, 0.001), 0.001);
  let sunSpecular = vec3f(1.0, 0.88, 0.69) * specularBrdf * noL * 2.4;

  let sunMirror = max(dot(reflectedDirection, sunDirection), 0.0);
  let glitter = pow(sunMirror, 340.0) * 2.2 + pow(sunMirror, 85.0) * 0.24;
  let waveMicro = 0.68 + 0.32 * valueNoise(surface.position.xz * 84.0 + vec2f(overlay.waveFront.z * 1.4, -overlay.waveFront.z * 1.1));
  let sunGlitter = vec3f(1.0, 0.92, 0.76) * glitter * waveMicro;

  let nearFront = 1.0 - smoothstep(0.0, overlay.waveShape.y * 2.2, surface.waterDistance);
  let forwardScatter = pow(max(dot(viewDirection, -sunDirection), 0.0), 4.0) * nearFront;
  transmission += scatterColor * (nearFront * 0.08 + forwardScatter * 0.11) * (1.0 - fresnel);

  var waterColor = transmission * (1.0 - fresnel) + reflection * fresnel + sunSpecular + sunGlitter;
  let opticalWeight = mix(0.88, 1.0, overlay.waveShape.w) * waterMask;
  let sourceLinear = toLinear(source.rgb);
  var color = mix(sourceLinear, waterColor, opticalWeight);

  let foam = sampleSurface(surface.position.xz).a * waterMask;
  let foamLight = 0.62 + noL * 0.38;
  let foamColor = vec3f(0.94, 0.975, 1.0) * foamLight + reflection * 0.08;
  let foamOpacity = foam * mix(0.54, 0.82, smoothstep(0.0, 0.9, foam));
  color = mix(color, foamColor, foamOpacity);
  color += vec3f(1.0, 0.96, 0.88) * foam * sunGlitter * 0.07;

  return vec4f(clamp(toSrgb(color), vec3f(0.0), vec3f(1.0)), source.a);
}
`,Me=`
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
struct VertexOutput { @builtin(position) clip: vec4f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var output: VertexOutput;
  output.clip = vec4f(positions[index], 0.0, 1.0);
  return output;
}
fn toneMap(color: vec3f) -> vec3f {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}
fn toSrgb(color: vec3f) -> vec3f {
  return select(color * 12.92, 1.055 * pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055, color > vec3f(0.0031308));
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let pixel = vec2i(input.clip.xy);
  let radiance = textureLoad(sourceTexture, pixel, 0).rgb;
  return vec4f(toSrgb(toneMap(radiance)), 1.0);
}
`,Ne=`
struct PostView { texel: vec4f }
@group(0) @binding(0) var postSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> postView: PostView;
@group(0) @binding(3) var glintTexture: texture_2d<f32>;
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
  let viewport = max(postView.texel.zw, vec2f(1.0));
  let portraitTame = 1.0 - smoothstep(0.70, 1.10, viewport.x / viewport.y);
  let glintTexel = texel * mix(1.0, 0.58, portraitTame);
  let glintGain = mix(1.0, 0.62, portraitTame);
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

  let glintCenter = textureSample(glintTexture, postSampler, input.uv).r * glintGain;

  let hx1p = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x, 0.0)).r * glintGain;
  let hx1m = textureSample(glintTexture, postSampler, input.uv - vec2f(glintTexel.x, 0.0)).r * glintGain;
  let hy1p = textureSample(glintTexture, postSampler, input.uv + vec2f(0.0, glintTexel.y)).r * glintGain;
  let hy1m = textureSample(glintTexture, postSampler, input.uv - vec2f(0.0, glintTexel.y)).r * glintGain;
  let hx2p = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x * 2.0, 0.0)).r * glintGain;
  let hx2m = textureSample(glintTexture, postSampler, input.uv - vec2f(glintTexel.x * 2.0, 0.0)).r * glintGain;
  let hy2p = textureSample(glintTexture, postSampler, input.uv + vec2f(0.0, glintTexel.y * 2.0)).r * glintGain;
  let hy2m = textureSample(glintTexture, postSampler, input.uv - vec2f(0.0, glintTexel.y * 2.0)).r * glintGain;
  let hx3p = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x * 3.0, 0.0)).r * glintGain;
  let hx3m = textureSample(glintTexture, postSampler, input.uv - vec2f(glintTexel.x * 3.0, 0.0)).r * glintGain;
  let hy3p = textureSample(glintTexture, postSampler, input.uv + vec2f(0.0, glintTexel.y * 3.0)).r * glintGain;
  let hy3m = textureSample(glintTexture, postSampler, input.uv - vec2f(0.0, glintTexel.y * 3.0)).r * glintGain;
  let hx4p = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x * 4.5, 0.0)).r * glintGain;
  let hx4m = textureSample(glintTexture, postSampler, input.uv - vec2f(glintTexel.x * 4.5, 0.0)).r * glintGain;
  let hy4p = textureSample(glintTexture, postSampler, input.uv + vec2f(0.0, glintTexel.y * 4.5)).r * glintGain;
  let hy4m = textureSample(glintTexture, postSampler, input.uv - vec2f(0.0, glintTexel.y * 4.5)).r * glintGain;

  let d11 = textureSample(glintTexture, postSampler, input.uv + glintTexel).r * glintGain;
  let d12 = textureSample(glintTexture, postSampler, input.uv + vec2f(-glintTexel.x, glintTexel.y)).r * glintGain;
  let d13 = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x, -glintTexel.y)).r * glintGain;
  let d14 = textureSample(glintTexture, postSampler, input.uv - glintTexel).r * glintGain;
  let d21 = textureSample(glintTexture, postSampler, input.uv + glintTexel * 2.0).r * glintGain;
  let d22 = textureSample(glintTexture, postSampler, input.uv + vec2f(-glintTexel.x * 2.0, glintTexel.y * 2.0)).r * glintGain;
  let d23 = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x * 2.0, -glintTexel.y * 2.0)).r * glintGain;
  let d24 = textureSample(glintTexture, postSampler, input.uv - glintTexel * 2.0).r * glintGain;
  let d31 = textureSample(glintTexture, postSampler, input.uv + glintTexel * 3.0).r * glintGain;
  let d32 = textureSample(glintTexture, postSampler, input.uv + vec2f(-glintTexel.x * 3.0, glintTexel.y * 3.0)).r * glintGain;
  let d33 = textureSample(glintTexture, postSampler, input.uv + vec2f(glintTexel.x * 3.0, -glintTexel.y * 3.0)).r * glintGain;
  let d34 = textureSample(glintTexture, postSampler, input.uv - glintTexel * 3.0).r * glintGain;

  let crossTight = (hx1p + hx1m + hy1p + hy1m) * 0.20
    + (hx2p + hx2m + hy2p + hy2m) * 0.14
    + (hx3p + hx3m + hy3p + hy3m) * 0.09;
  let crossSoft = (hx1p + hx1m + hy1p + hy1m) * 0.18
    + (hx2p + hx2m + hy2p + hy2m) * 0.17
    + (hx3p + hx3m + hy3p + hy3m) * 0.13
    + (hx4p + hx4m + hy4p + hy4m) * 0.08;
  let diagonal = (d11 + d12 + d13 + d14) * 0.14
    + (d21 + d22 + d23 + d24) * 0.11
    + (d31 + d32 + d33 + d34) * 0.08;
  let star = crossTight + diagonal * 0.55;
  let smear = crossSoft * 0.56 + diagonal * 0.48;

  let coreMask = smoothstep(0.010, 0.038, glintCenter);
  let streakMask = smoothstep(0.010, 0.080, star + glintCenter * 0.18);
  let smearMask = smoothstep(0.008, 0.070, smear + glintCenter * 0.22);
  let warmWhite = vec3f(1.0, 0.998, 0.988);
  let solarTint = vec3f(1.0, 0.992, 0.95);
  var composite = color + solarTint * smear * mix(0.16, 0.08, portraitTame);
  composite += warmWhite * star * mix(0.10, 0.05, portraitTame);
  composite = mix(composite, warmWhite, coreMask * mix(0.82, 0.50, portraitTame));
  composite += solarTint * streakMask * mix(0.07, 0.035, portraitTame);
  composite += vec3f(1.0, 0.99, 0.94) * smearMask * mix(0.06, 0.03, portraitTame);
  return vec4f(clamp(composite, vec3f(0.0), vec3f(1.0)), 1.0);
}
`,Z=`rgba16float`,Q=`r16float`,Pe=class{uniform;overlayUniform;sampler;legacyEncodeModule;postModule;waterFieldModule;waterCausticModule;overlayModule;legacyEncodePipeline;postPipeline;waterFieldPipeline;waterCausticPipeline;overlayPipeline;legacyEncodeGroup;postGroup;waterFieldGroup;waterCausticGroup;overlayGroup;hdrScene;hdrSceneView;glintScene;glintSceneView;legacyScene;legacySceneView;compositeScene;compositeSceneView;waterSurfaceField;waterSurfaceFieldView;waterMotionField;waterMotionFieldView;waterCausticField;waterCausticFieldView;waveActive=!1;width=0;height=0;device;legacyFormat;targetFormat;constructor(e,t,n){this.device=e,this.legacyFormat=t,this.targetFormat=n,this.uniform=e.createBuffer({label:`Filmic post uniform`,size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.overlayUniform=e.createBuffer({label:`Wave overlay uniform`,size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.sampler=e.createSampler({label:`Filmic post sampler`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),this.waterSurfaceField=e.createTexture({label:`Reset water surface field`,size:[q,q],format:J,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.waterSurfaceFieldView=this.waterSurfaceField.createView(),this.waterMotionField=e.createTexture({label:`Reset water motion field`,size:[q,q],format:J,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.waterMotionFieldView=this.waterMotionField.createView(),this.waterCausticField=e.createTexture({label:`Reset water caustic field`,size:[q,q],format:Y,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.waterCausticFieldView=this.waterCausticField.createView(),this.legacyEncodeModule=e.createShaderModule({label:`Legacy display encode WGSL`,code:Me}),this.postModule=e.createShaderModule({label:`Filmic post WGSL`,code:Ne}),this.waterFieldModule=e.createShaderModule({label:`Reset water field WGSL`,code:ke}),this.waterCausticModule=e.createShaderModule({label:`Reset water caustic WGSL`,code:Ae}),this.overlayModule=e.createShaderModule({label:`Wave overlay WGSL`,code:je})}async initialize(){[this.legacyEncodePipeline,this.postPipeline,this.waterFieldPipeline,this.waterCausticPipeline,this.overlayPipeline]=await Promise.all([this.device.createRenderPipelineAsync({label:`Legacy display encode`,layout:`auto`,vertex:{module:this.legacyEncodeModule,entryPoint:`vertex`},fragment:{module:this.legacyEncodeModule,entryPoint:`fragment`,targets:[{format:this.legacyFormat}]},primitive:{topology:`triangle-list`}}),this.device.createRenderPipelineAsync({label:`Filmic post process`,layout:`auto`,vertex:{module:this.postModule,entryPoint:`vertex`},fragment:{module:this.postModule,entryPoint:`fragment`,targets:[{format:this.targetFormat}]},primitive:{topology:`triangle-list`}}),this.device.createRenderPipelineAsync({label:`Reset water field`,layout:`auto`,vertex:{module:this.waterFieldModule,entryPoint:`vertex`},fragment:{module:this.waterFieldModule,entryPoint:`fragment`,targets:[{format:J},{format:J}]},primitive:{topology:`triangle-list`}}),this.device.createRenderPipelineAsync({label:`Reset water caustics`,layout:`auto`,vertex:{module:this.waterCausticModule,entryPoint:`vertex`},fragment:{module:this.waterCausticModule,entryPoint:`fragment`,targets:[{format:Y}]},primitive:{topology:`triangle-list`}}),this.device.createRenderPipelineAsync({label:`Wave overlay composite`,layout:`auto`,vertex:{module:this.overlayModule,entryPoint:`vertex`},fragment:{module:this.overlayModule,entryPoint:`fragment`,targets:[{format:this.targetFormat}]},primitive:{topology:`triangle-list`}})]),this.waterFieldGroup=this.device.createBindGroup({layout:this.waterFieldPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.overlayUniform}}]}),this.waterCausticGroup=this.device.createBindGroup({layout:this.waterCausticPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.overlayUniform}},{binding:1,resource:this.sampler},{binding:2,resource:this.waterSurfaceFieldView},{binding:3,resource:this.waterMotionFieldView}]})}resize(e,t){(e!==this.width||t!==this.height)&&(this.hdrScene?.destroy(),this.glintScene?.destroy(),this.legacyScene?.destroy(),this.compositeScene?.destroy(),this.width=e,this.height=t,this.hdrScene=this.device.createTexture({label:`Linear HDR scene color`,size:[e,t],format:Z,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.hdrSceneView=this.hdrScene.createView(),this.glintScene=this.device.createTexture({label:`Reflective mineral HDR glints`,size:[e,t],format:Q,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.glintSceneView=this.glintScene.createView(),this.legacyScene=this.device.createTexture({label:`Legacy display scene color`,size:[e,t],format:this.legacyFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.legacySceneView=this.legacyScene.createView(),this.compositeScene=this.device.createTexture({label:`Filmic composite scene color`,size:[e,t],format:this.targetFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.compositeSceneView=this.compositeScene.createView(),this.legacyEncodeGroup=this.device.createBindGroup({layout:this.legacyEncodePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.hdrSceneView}]}),this.postGroup=this.device.createBindGroup({layout:this.postPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.sampler},{binding:1,resource:this.legacySceneView},{binding:2,resource:{buffer:this.uniform}},{binding:3,resource:this.glintSceneView}]}),this.overlayGroup=this.device.createBindGroup({layout:this.overlayPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.overlayUniform}},{binding:1,resource:this.sampler},{binding:2,resource:this.compositeSceneView},{binding:3,resource:this.waterSurfaceFieldView},{binding:4,resource:this.waterCausticFieldView}]}),this.device.queue.writeBuffer(this.uniform,0,new Float32Array([1/e,1/t,e,t])))}setWaveState(e,t){this.waveActive=e.active;let n=new Float32Array([...t.eye,t.tanHalfFov,...t.forward,t.aspect,...t.right,0,...t.up,0,+!!e.active,e.currentBaseFront,e.time,d.extent*.5,w.shorelineFeather,w.foamWidth,w.foamTrail,w.waterOpacity,w.waterTintStrength,w.washGloss,w.rippleScale,w.rippleDrift]);this.device.queue.writeBuffer(this.overlayUniform,0,n)}get target(){if(!this.hdrSceneView)throw Error(`Post process textures are not initialized.`);return this.hdrSceneView}get glintTarget(){if(!this.glintSceneView)throw Error(`Post process textures are not initialized.`);return this.glintSceneView}encode(e,t){if(!this.legacySceneView||!this.compositeSceneView)throw Error(`Post process textures are not initialized.`);let n=e.beginRenderPass({label:`Legacy display encode`,colorAttachments:[{view:this.legacySceneView,loadOp:`clear`,storeOp:`store`,clearValue:{r:.55,g:.44,b:.29,a:1}}]});if(n.setPipeline(this.legacyEncodePipeline),n.setBindGroup(0,this.legacyEncodeGroup),n.draw(3),n.end(),this.waveActive){let t=e.beginRenderPass({label:`Reset water fields`,colorAttachments:[{view:this.waterSurfaceFieldView,clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`},{view:this.waterMotionFieldView,clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});t.setPipeline(this.waterFieldPipeline),t.setBindGroup(0,this.waterFieldGroup),t.draw(3),t.end();let n=e.beginRenderPass({label:`Reset water caustics`,colorAttachments:[{view:this.waterCausticFieldView,clearValue:{r:1,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.waterCausticPipeline),n.setBindGroup(0,this.waterCausticGroup),n.draw(3),n.end()}let r=this.waveActive?this.compositeSceneView:t,i=e.beginRenderPass({label:`Filmic composite`,colorAttachments:[{view:r,clearValue:{r:.55,g:.44,b:.29,a:1},loadOp:`clear`,storeOp:`store`}]});if(i.setPipeline(this.postPipeline),i.setBindGroup(0,this.postGroup),i.draw(3),i.end(),this.waveActive){let n=e.beginRenderPass({label:`Wave overlay composite`,colorAttachments:[{view:t,clearValue:{r:.55,g:.44,b:.29,a:1},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.overlayPipeline),n.setBindGroup(0,this.overlayGroup),n.draw(3),n.end()}}dispose(){this.hdrScene?.destroy(),this.glintScene?.destroy(),this.legacyScene?.destroy(),this.compositeScene?.destroy(),this.waterSurfaceField.destroy(),this.waterMotionField.destroy(),this.waterCausticField.destroy(),this.uniform.destroy(),this.overlayUniform.destroy()}},Fe=`
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
@group(0) @binding(6) var airborneShadowSampler: sampler;
@group(0) @binding(7) var airborneShadowTexture: texture_2d<f32>;
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
fn grainAxis(random: vec2f) -> vec2f {
  let horizontal = random.x * 2.0 - 1.0;
  let verticalMagnitude = max(0.08, 1.0 - abs(horizontal));
  let vertical = select(-verticalMagnitude, verticalMagnitude, random.y >= 0.5);
  return normalize(vec2f(horizontal, vertical));
}
fn warpGrainCoordinate(coordinate: vec2f) -> vec2f {
  let waveA = sin(dot(coordinate, vec2f(0.071, 0.109)) + 1.37);
  let waveB = sin(dot(coordinate, vec2f(-0.097, 0.063)) - 0.82);
  return coordinate + vec2f(waveA, waveB) * 0.14;
}
struct GrainAppearance {
  offset: vec2f,
  shapedOffset: vec2f,
  axis: vec2f,
  color: vec2f,
  materialSeed: vec2f,
  grainCell: vec2f,
  edge: f32,
  roundness: f32,
}
fn grainAppearance(coordinate: vec2f) -> GrainAppearance {
  let warpedCoordinate = warpGrainCoordinate(coordinate);
  let baseCell = floor(warpedCoordinate);
  var nearest = 100.0;
  var second = 100.0;
  var grainOffset = vec2f(0.0);
  var shapedOffset = vec2f(0.0);
  var selectedAxis = vec2f(1.0, 0.0);
  var grainColor = vec2f(0.5);
  var selectedCell = vec2f(0.0);
  for (var row = -1; row <= 1; row++) {
    for (var column = -1; column <= 1; column++) {
      let cell = baseCell + vec2f(f32(column), f32(row));
      let random = hash2(cell);
      let center = cell + (0.16 + 0.68 * random);
      let offset = warpedCoordinate - center;
      let axis = grainAxis(random);
      let perpendicular = vec2f(-axis.y, axis.x);
      let aspectSeed = fract(random.x * 5.37 + random.y * 7.91);
      let aspect = mix(0.78, 1.27, aspectSeed);
      let local = vec2f(dot(offset, axis) / aspect, dot(offset, perpendicular) * aspect);
      let distance = dot(local, local);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        grainOffset = offset;
        shapedOffset = local;
        selectedAxis = axis;
        grainColor = random;
        selectedCell = cell;
      } else {
        second = min(second, distance);
      }
    }
  }
  let boundary = sqrt(second) - sqrt(nearest);
  let materialSeed = hash2(selectedCell + vec2f(87.17, 31.73));
  let rawRoundness = sqrt(max(0.0, 1.0 - min(nearest / 0.44, 1.0)));
  let angularity = mix(rawRoundness, smoothstep(0.04, 0.96, rawRoundness), materialSeed.y * 0.46);
  return GrainAppearance(grainOffset, shapedOffset, selectedAxis, grainColor, materialSeed, selectedCell,
    smoothstep(0.014, 0.145, boundary), angularity);
}
struct SandMaterial {
  albedo: vec3f,
  roughness: f32,
  translucency: f32,
  fresnelBase: f32,
  sparkleAffinity: f32,
}
fn materialForGrain(seed: vec2f, composition: f32) -> SandMaterial {
  let family = fract(seed.x + (composition - 0.5) * 0.085);
  var albedo = vec3f(0.67, 0.51, 0.30);
  var roughness = 0.50;
  var translucency = 0.09;
  var fresnelBase = 0.040;
  var sparkleAffinity = 0.50;
  if (family < 0.36) {
    albedo = vec3f(0.72, 0.57, 0.35);
    roughness = 0.38;
    translucency = 0.17;
    sparkleAffinity = 0.72;
  } else if (family < 0.66) {
    albedo = vec3f(0.65, 0.48, 0.27);
    roughness = 0.48;
    translucency = 0.10;
    sparkleAffinity = 0.48;
  } else if (family < 0.82) {
    albedo = vec3f(0.75, 0.60, 0.38);
    roughness = 0.31;
    translucency = 0.21;
    sparkleAffinity = 0.64;
  } else if (family < 0.92) {
    albedo = vec3f(0.54, 0.34, 0.18);
    roughness = 0.58;
    translucency = 0.035;
    sparkleAffinity = 0.20;
  } else if (family < 0.972) {
    albedo = vec3f(0.43, 0.27, 0.15);
    roughness = 0.63;
    translucency = 0.02;
    sparkleAffinity = 0.12;
  } else {
    albedo = vec3f(0.22, 0.17, 0.12);
    roughness = 0.69;
    translucency = 0.0;
    fresnelBase = 0.048;
    sparkleAffinity = 0.04;
  }
  let tint = (seed.y - 0.5) * 0.10;
  albedo *= vec3f(1.0 + tint, 1.0 + tint * 0.52, 1.0 - tint * 0.45);
  roughness = clamp(roughness + (seed.y - 0.5) * 0.10, 0.24, 0.76);
  return SandMaterial(albedo, roughness, translucency, fresnelBase, sparkleAffinity);
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
fn airborneShadow(position: vec2f) -> f32 {
  let uv = vec2f(position.x / view.grid.y + 0.5, 0.5 - position.y / view.grid.y);
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 1.0; }
  let opticalDepth = textureSampleLevel(airborneShadowTexture, airborneShadowSampler, uv, 0.0).x;
  return exp(-opticalDepth * ${d.airborneShadowStrength});
}
fn microfacetDistribution(alphaSquared: f32, normalHalf: f32) -> f32 {
  let denominator = normalHalf * normalHalf * (alphaSquared - 1.0) + 1.0;
  return alphaSquared / max(3.141593 * denominator * denominator, 0.0001);
}
fn geometryAttenuation(cosine: f32, viewCosine: f32) -> f32 {
  return cosine * viewCosine / max((cosine * 0.7 + 0.3) * (viewCosine * 0.7 + 0.3), 0.001);
}
fn reflectiveGlintAt(position: vec2f, normal: vec3f, towardEye: vec3f, light: vec3f, visibility: f32, pixelWidth: f32, affinity: f32) -> f32 {
  let cellSize = 0.0048;
  let cell = floor(position / cellSize);
  let selector = hash2(cell + vec2f(13.7, 41.3));
  if (selector.x <= 0.995) { return 0.0; }

  let centerSeed = hash2(cell + vec2f(73.1, 19.6));
  let center = (cell + 0.12 + centerSeed * 0.76) * cellSize;
  let physicalRadius = mix(0.00006, 0.00014, selector.y);
  let opticalRadius = max(physicalRadius, pixelWidth * 1.45);
  let centerDistance = length(position - center);
  if (centerDistance > opticalRadius) { return 0.0; }

  let halfway = normalize(light + towardEye);
  let normalHalf = max(dot(normal, halfway), 0.02);
  let tangentHalf = length(cross(normal, halfway));
  let requiredSlope = tangentHalf / normalHalf;
  let slopeSigma = 0.46;
  let facetProbability = exp(-0.5 * requiredSlope * requiredSlope / (slopeSigma * slopeSigma));
  let activationProbability = clamp((0.55 + facetProbability * 0.36) * mix(0.72, 1.08, affinity), 0.0, 0.94);
  let orientationSeed = hash2(cell + vec2f(151.7, 223.9));
  if (orientationSeed.x > activationProbability) { return 0.0; }

  let footprint = 1.0 - smoothstep(0.22, 1.0, centerDistance / opticalRadius);
  let shadowed = smoothstep(0.06, 0.52, visibility);
  let intensity = mix(1.6, 2.6, orientationSeed.y) * mix(0.72, 1.10, affinity);
  return footprint * shadowed * intensity;
}
struct FragmentOutput { @location(0) color: vec4f, @location(1) glint: f32, @builtin(frag_depth) depth: f32 }
fn shadeSurface(input: VertexOutput, filteredCoordinate: vec2f, appearanceDetail: f32, depthDetail: f32, reflectivePixelWidth: f32) -> FragmentOutput {
  let position = input.world.xz;
  let spacing = view.grid.y / view.grid.x;
  let heightLeft = stateAt(position - vec2f(spacing, 0.0)).x;
  let heightRight = stateAt(position + vec2f(spacing, 0.0)).x;
  let heightBack = stateAt(position - vec2f(0.0, spacing)).x;
  let heightFront = stateAt(position + vec2f(0.0, spacing)).x;
  let macroNormal = normalize(vec3f(heightLeft - heightRight, 2.0 * spacing, heightBack - heightFront));
  let grain = grainAppearance(filteredCoordinate);
  let grainEdge = grain.edge;
  let roundness = grain.roundness;
  let heightSeed = fract(grain.materialSeed.x * 3.71 + grain.color.y * 5.17);
  let grainHeight = depthDetail * grainEdge * roundness * mix(0.000038, 0.000126, heightSeed);
  let perpendicular = vec2f(-grain.axis.y, grain.axis.x);
  let radial = grain.axis * grain.shapedOffset.x + perpendicular * grain.shapedOffset.y;
  let facetJitter = (grain.materialSeed - 0.5) * 0.34;
  let facet = radial * (0.34 + roundness * 0.46) + facetJitter;
  let normal = normalize(macroNormal + vec3f(facet.x, 0.0, facet.y) * appearanceDetail);
  let displacedWorld = input.world + macroNormal * grainHeight;
  let light = normalize(view.light.xyz);
  let towardEye = normalize(view.eye.xyz - displacedWorld);
  let halfway = normalize(light + towardEye);
  let cosine = max(0.0, dot(normal, light));
  let viewCosine = max(0.02, dot(normal, towardEye));
  let illumination = illuminationAt(position);
  let shade = treeShadow(position);
  let sprayShade = airborneShadow(position);
  let visibility = illumination.x * shade * sprayShade;
  let occlusion = illumination.y;
  let composition = hash2(floor(grain.grainCell / 42.0) + vec2f(41.0, 67.0)).x;
  let material = materialForGrain(grain.materialSeed, composition);
  let microOcclusion = mix(1.0, mix(0.61, 1.0, grainEdge), appearanceDetail);
  let grainAlbedo = material.albedo * mix(0.64, 1.0, grainEdge);
  let albedo = mix(vec3f(0.59, 0.435, 0.25), grainAlbedo, appearanceDetail);
  let roughness = mix(0.80, material.roughness, appearanceDetail);
  let alphaSquared = pow(roughness, 4.0);
  let normalHalf = max(0.0, dot(normal, halfway));
  let distribution = microfacetDistribution(alphaSquared, normalHalf);
  let fresnel = material.fresnelBase + (1.0 - material.fresnelBase) * pow(1.0 - max(0.0, dot(halfway, towardEye)), 5.0);
  let geometry = geometryAttenuation(cosine, viewCosine);
  let specular = distribution * fresnel * geometry / max(4.0 * cosine * viewCosine, 0.001);
  let diffuse = cosine * (0.84 + 0.16 * (1.0 - viewCosine));
  let ambient = environment(normal) * (0.24 + 0.16 * macroNormal.y) * occlusion * microOcclusion * mix(0.70, 1.0, shade);
  let direct = vec3f(1.0, 0.89, 0.69) * 2.55 * visibility * microOcclusion;
  let reflected = reflect(-towardEye, normal);
  let environmentSpecular = environment(reflected) * fresnel * pow(1.0 - roughness, 2.0) * 0.32 * occlusion * mix(0.42, 1.0, shade);
  let bodyTransmission = albedo * direct * material.translucency * (0.018 + 0.050 * (1.0 - viewCosine)) * roundness * appearanceDetail;
  let reflectiveGlint = reflectiveGlintAt(position, normal, towardEye, light, visibility, reflectivePixelWidth, material.sparkleAffinity);
  var radiance = albedo * (ambient + direct * diffuse) + direct * specular * cosine + environmentSpecular + bodyTransmission;
  let ringDistance = abs(length(position - view.pointer.xy) - view.pointer.z);
  let ring = (1.0 - smoothstep(0.0003, 0.0008, ringDistance)) * view.pointer.w;
  radiance *= 1.0 - 0.2 * ring;
  let projected = project(displacedWorld);
  var output: FragmentOutput;
  output.color = vec4f(radiance, 1.0);
  output.glint = reflectiveGlint;
  output.depth = projected.z / projected.w;
  return output;
}
@fragment fn fragment(input: VertexOutput) -> FragmentOutput {
  let grainCoordinate = input.world.xz / 0.00043;
  let footprint = max(length(dpdx(grainCoordinate)), length(dpdy(grainCoordinate)));
  let reflectivePixelWidth = footprint * 0.00043;
  let appearanceDetail = 1.0 - smoothstep(0.55, 2.1, footprint);
  let depthDetail = appearanceDetail;
  return shadeSurface(input, grainCoordinate, appearanceDetail, depthDetail, reflectivePixelWidth);
}
@fragment fn fragmentMobile(input: VertexOutput) -> FragmentOutput {
  let grainCoordinate = input.world.xz / 0.00043;
  let grainDx = dpdx(grainCoordinate);
  let grainDy = dpdy(grainCoordinate);
  let footprint = max(length(grainDx), length(grainDy));
  let reflectivePixelWidth = footprint * 0.00043;

  // Phones need one stable stochastic sample inside the real pixel footprint
  // once grain spacing approaches the framebuffer sampling rate. Keep visible
  // material detail intact; only grain depth relief fades when it is unresolved.
  let stochasticAmount = smoothstep(0.32, 0.58, footprint);
  let pixel = floor(input.clip.xy);
  let jitter = hash2(pixel + vec2f(19.0, 71.0)) - 0.5;
  let filteredCoordinate = grainCoordinate + stochasticAmount * (grainDx * jitter.x + grainDy * jitter.y);
  let appearanceDetail = 1.0;
  let depthDetail = 1.0 - smoothstep(0.48, 0.90, footprint);
  return shadeSurface(input, filteredCoordinate, appearanceDetail, depthDetail, reflectivePixelWidth);
}
struct GrainOutput {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) tint: f32,
  @location(2) center: vec3f,
  @location(3) radius: f32,
  @location(4) physicalRadius: f32,
  @location(5) trailRatio: f32,
  @location(6) axis: vec2f,
}
@vertex fn grainVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> GrainOutput {
  let corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let grain = grains[instance];
  let corner = corners[vertex];
  let enabled = grain.position.w > 0.0;
  let physicalRadius = select(0.0, ${d.airborneGrainRadius} * pow(max(grain.position.w, 1e-9) / ${d.airborneReferenceMass}, 1.0 / 3.0), enabled);
  let relative = grain.position.xyz - view.eye.xyz;
  let cameraDepth = max(dot(relative, view.forward.xyz), 0.01);
  let worldPerPixel = 2.0 * view.eye.w * cameraDepth / max(view.grid.w, 1.0);
  let renderRadius = max(physicalRadius, worldPerPixel * 0.72);
  let cameraVelocity = vec2f(dot(grain.velocity.xyz, view.right.xyz), dot(grain.velocity.xyz, view.up.xyz));
  let projectedSpeed = length(cameraVelocity);
  let axis = select(vec2f(1.0, 0.0), cameraVelocity / max(projectedSpeed, 1e-8), projectedSpeed > 1e-5);
  let side = vec2f(-axis.y, axis.x);
  let shutter = 0.0035;
  let halfTrail = min(projectedSpeed * shutter * 0.5, worldPerPixel * 3.0);
  let blurCenter = grain.position.xyz - (view.right.xyz * cameraVelocity.x + view.up.xyz * cameraVelocity.y) * shutter * 0.5;
  let extent = renderRadius + halfTrail;
  let cameraOffset = axis * (corner.x * extent) + side * (corner.y * renderRadius);
  let position = blurCenter + view.right.xyz * cameraOffset.x + view.up.xyz * cameraOffset.y;
  var output: GrainOutput;
  output.clip = select(vec4f(2.0, 2.0, 2.0, 1.0), project(position), enabled);
  output.local = vec2f(corner.x * extent / max(renderRadius, 1e-9), corner.y);
  output.tint = hash2(vec2f(f32(instance), 17.0)).x;
  output.center = blurCenter;
  output.radius = renderRadius;
  output.physicalRadius = physicalRadius;
  output.trailRatio = halfTrail / max(renderRadius, 1e-9);
  output.axis = axis;
  return output;
}
struct GrainFragmentOutput { @location(0) color: vec4f, @location(1) glint: f32, @builtin(frag_depth) depth: f32 }
@fragment fn grainFragment(input: GrainOutput) -> GrainFragmentOutput {
  let excess = max(abs(input.local.x) - input.trailRatio, 0.0);
  let local = vec2f(sign(input.local.x) * excess, input.local.y);
  let squared = dot(local, local);
  if (squared > 1.0) { discard; }
  let sphereDepth = sqrt(max(0.0, 1.0 - squared));
  let axisWorld = view.right.xyz * input.axis.x + view.up.xyz * input.axis.y;
  let sideWorld = view.right.xyz * -input.axis.y + view.up.xyz * input.axis.x;
  let nearest = input.center + axisWorld * (clamp(input.local.x, -input.trailRatio, input.trailRatio) * input.radius);
  let normal = normalize(axisWorld * local.x + sideWorld * local.y - view.forward.xyz * sphereDepth);
  let surface = nearest + normal * input.radius;
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
  let physicalArea = 3.141593 * input.physicalRadius * input.physicalRadius;
  let capsuleArea = 3.141593 * input.radius * input.radius + 4.0 * input.radius * (input.trailRatio * input.radius);
  let areaCoverage = clamp(physicalArea / max(capsuleArea, 1e-12), 0.0, 1.0);
  let profile = 1.0 - smoothstep(0.34, 1.0, squared);
  let alpha = min(0.94, areaCoverage * profile * 2.15);
  let projected = project(surface);
  var output: GrainFragmentOutput;
  output.color = vec4f(radiance * alpha, alpha);
  output.glint = sparkle * alpha * 0.18;
  output.depth = projected.z / projected.w;
  return output;
}
`,$=-.8,Ie=[Math.cos($),.65,Math.sin($)],Le=class{camera=new ue;uniform;lighting;shadow;airborneShadow;post;indices;indexCount;pipeline;grainPipeline;grainGroup;groups=[];depth;width=0;height=0;data=new Float32Array(36);device;solver;mobileGrainFiltering;constructor(e,t,n,r=!1){this.device=e,this.solver=t,this.mobileGrainFiltering=r,this.uniform=e.createBuffer({label:`Surface view`,size:this.data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.lighting=new De(e,t,this.uniform),this.shadow=new Te(e,r),this.airborneShadow=new ce(e,t),this.post=new Pe(e,n,n);let i=t.resolution;this.indexCount=(i-1)**2*6;let a=new Uint32Array(this.indexCount),o=0;for(let e=0;e<i-1;e++)for(let t=0;t<i-1;t++){let n=e*i+t;a.set([n,n+i,n+1,n+1,n+i,n+i+1],o),o+=6}this.indices=e.createBuffer({label:`Sand grid topology`,size:a.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST}),e.queue.writeBuffer(this.indices,0,a)}async initialize(){await Promise.all([this.lighting.initialize(),this.shadow.initialize(),this.airborneShadow.initialize(),this.post.initialize()]);let e=await z(this.device,`Granular surface WGSL`,Fe);this.pipeline=await this.device.createRenderPipelineAsync({label:`Granular sand surface`,layout:`auto`,vertex:{module:e,entryPoint:`vertex`},fragment:{module:e,entryPoint:this.mobileGrainFiltering?`fragmentMobile`:`fragment`,targets:[{format:Z},{format:Q}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),this.groups=this.solver.buffers.map(e=>this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:{buffer:e}},{binding:3,resource:{buffer:this.lighting.buffer}},{binding:4,resource:this.shadow.sampler},{binding:5,resource:this.shadow.texture.createView()},{binding:6,resource:this.airborneShadow.sampler},{binding:7,resource:this.airborneShadow.texture.createView()}]})),this.grainPipeline=await this.device.createRenderPipelineAsync({label:`Loose sand grains`,layout:`auto`,vertex:{module:e,entryPoint:`grainVertex`},fragment:{module:e,entryPoint:`grainFragment`,targets:[{format:Z,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}},{format:Q,blend:{color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),this.grainGroup=this.device.createBindGroup({layout:this.grainPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:2,resource:{buffer:this.solver.particles}},{binding:4,resource:this.shadow.sampler},{binding:5,resource:this.shadow.texture.createView()}]})}resize(e,t){(e!==this.width||t!==this.height)&&(this.depth?.destroy(),this.width=e,this.height=t,this.camera.aspect=e/t,this.depth=this.device.createTexture({label:`Surface depth`,size:[e,t],format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.post.resize(e,t),this.shadow.resize(e,t,(n,r)=>this.camera.screenToBed(n,r,e,t)))}encode(e,t,n,r,i=!1,a=R()){if(!this.depth)throw Error(`Renderer needs a nonzero drawing buffer`);this.shadow.encode(e,r),this.data.set([...this.camera.eye,this.camera.tanHalfFov,...this.camera.forward,this.camera.aspect,...this.camera.right,0,...this.camera.up,0,...Ie,0,this.solver.resolution,d.extent,this.width,this.height,n.to.x,n.to.y,n.radius,+!!i,this.shadow.centerX,this.shadow.centerZ,this.shadow.halfWidth,this.shadow.halfHeight,this.shadow.opacity,0,0,0]),this.device.queue.writeBuffer(this.uniform,0,this.data),(!a.active||!a.incoming)&&this.lighting.encode(e,$),a.justStarted?this.airborneShadow.clear(e):a.active||this.airborneShadow.encode(e,Ie);let o=e.beginRenderPass({label:`Sand image`,colorAttachments:[{view:this.post.target,clearValue:{r:.1778341,g:.12052718,b:.06615726,a:1},loadOp:`clear`,storeOp:`store`},{view:this.post.glintTarget,clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.pipeline),o.setBindGroup(0,this.groups[this.solver.stateIndex]),o.setIndexBuffer(this.indices,`uint32`),o.drawIndexed(this.indexCount),a.active||(o.setPipeline(this.grainPipeline),o.setBindGroup(0,this.grainGroup),o.draw(6,this.solver.particleCount)),o.end(),this.post.setWaveState(a,this.camera),this.post.encode(e,t)}dispose(){this.lighting.dispose(),this.shadow.dispose(),this.airborneShadow.dispose(),this.post.dispose(),this.uniform.destroy(),this.indices.destroy(),this.depth?.destroy()}},Re=class{previous;accumulator=0;droppedSeconds=0;step;maxSteps;constructor(e,t){this.step=e,this.maxSteps=t}advance(e){if(this.previous===void 0)return this.previous=e,0;let t=Math.max(0,(e-this.previous)/1e3);this.previous=e;let n=this.step*this.maxSteps;this.droppedSeconds+=Math.max(0,t-n),this.accumulator+=Math.min(t,n);let r=Math.min(this.maxSteps,Math.floor((this.accumulator+1e-9)/this.step));return this.accumulator-=r*this.step,r}reset(e){this.previous=e,this.accumulator=0}},ze=`
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
`,Be=`
struct ToolContact {
  start: vec4f,
  end: vec4f,
  motion: vec4f,
}
struct Params {
  grid: vec4f,
  physics: vec4f,
  tool: vec4f,
  contacts: array<ToolContact, ${d.maxContacts}>,
}
`,Ve=`
${ze}
${Be}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> source: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> destination: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> flux: array<Flux>;
@group(0) @binding(4) var<storage, read_write> exchange: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read_write> contactField: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> contactPressure: array<f32>;
@group(0) @binding(7) var<storage, read_write> impactBudget: array<atomic<i32>>;

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
  for (var index = 0u; index < ${d.maxContacts}u; index++) {
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
fn impactResponse(speed: f32) -> f32 {
  return smoothstep(${d.impactSpeedStart}, ${d.impactSpeedFull}, speed);
}
fn impactCore(contact: vec4f, pressure: f32) -> f32 {
  return impactResponse(length(contact.zw)) * pressure * pow(contact.x, 1.75);
}
fn penetrationFor(contact: vec4f, pressure: f32) -> f32 {
  return contact.x * pressure * params.tool.y + impactCore(contact, pressure) * ${d.impactIndentation};
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
  let penetration = penetrationFor(toolContact, toolPressure);
  let effectiveHeight = center.x + penetration;
  let toolSpeed = length(toolContact.zw);
  let motionDirection = toolContact.zw / max(toolSpeed, 1e-8);
  let speedResponse = toolSpeed / (toolSpeed + 0.35);
  let impact = impactCore(toolContact, toolPressure);
  let centerShell = toolContact.y;
  var outgoing = Flux(vec4f(0.0), vec4f(0.0));
  var escape = Flux(vec4f(0.0), vec4f(0.0));
  var coverageGradient = vec2f(0.0);
  for (var axis = 0u; axis < 8u; axis++) {
    let neighbor = cell + neighbors[axis];
    if (any(neighbor < vec2i(0)) || any(neighbor >= vec2i(i32(params.grid.x)))) { continue; }
    let other = source[address(neighbor)];
    let otherContact = contactAt(neighbor);
    if (axis == 0u) { coverageGradient += vec2f(-otherContact.x * 0.5, 0.0); }
    if (axis == 1u) { coverageGradient += vec2f(otherContact.x * 0.5, 0.0); }
    if (axis == 2u) { coverageGradient += vec2f(0.0, -otherContact.x * 0.5); }
    if (axis == 3u) { coverageGradient += vec2f(0.0, otherContact.x * 0.5); }
    let otherPenetration = penetrationFor(otherContact, pressureAt(neighbor));
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
    amount *= 1.0 + toolContact.x * speedResponse * forward * 0.55 + impact * forward * 0.95;
    let edge = max(0.0, penetration - otherPenetration) / max(penetration, 1e-7);
    let sideways = toolContact.x * (1.0 - abs(dot(axisDirection, motionDirection))) * 0.06;
    let escapeWeight = (edge + sideways) * (1.0 + speedResponse * forward * 0.8 + impact * forward * 1.35) * weight;
    if (axis < 4u) {
      outgoing.axial[axis] = amount;
      escape.axial[axis] = escapeWeight;
    } else {
      outgoing.diagonal[axis - 4u] = amount;
      escape.diagonal[axis - 4u] = escapeWeight;
    }
  }
  let frontier = clamp(max(0.0, -dot(coverageGradient, motionDirection)) / max(toolContact.x, 0.1), 0.0, 1.0);
  let targetHeight = params.physics.x - penetration;
  let overlap = max(0.0, center.x - targetHeight);
  let existing = totalFlux(outgoing);
  let escapeTotal = totalFlux(escape);
  let evacuationFraction = mix(mix(0.32, 0.46, speedResponse), ${d.impactEvacuation}, impact);
  let extra = max(0.0, overlap * evacuationFraction - existing);
  if (extra > 0.0 && escapeTotal > 1e-8) {
    outgoing.axial += escape.axial * (extra / escapeTotal);
    outgoing.diagonal += escape.diagonal * (extra / escapeTotal);
  }
  let total = totalFlux(outgoing);
  let available = max(0.0, center.x - params.physics.y);
  let limiter = min(1.0, available / max(total, 1e-10));
  let limited = Flux(outgoing.axial * limiter, outgoing.diagonal * limiter);
  flux[address(cell)] = limited;
  let remaining = max(0.0, center.x - params.physics.y - totalFlux(limited));
  let desiredEjection = totalFlux(limited) * ${d.impactEjectionFraction} * impact * clamp(frontier * 1.4, 0.0, 1.0);
  atomicStore(&impactBudget[address(cell)], i32(round(min(remaining, desiredEjection) * 1e9)));
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
`,He=`
${ze}
${Be}
struct Grain { position: vec4f, velocity: vec4f }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> bed: array<vec4f>;
@group(0) @binding(2) var<storage, read> flux: array<Flux>;
@group(0) @binding(3) var<storage, read_write> grains: array<Grain>;
@group(0) @binding(4) var<storage, read_write> exchange: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read> contactField: array<vec4f>;
@group(0) @binding(6) var<storage, read> contactPressure: array<f32>;
@group(0) @binding(7) var<storage, read_write> impactBudget: array<atomic<i32>>;
fn random(seed: u32) -> f32 {
  var value = seed * 747796405u + 2891336453u;
  value = ((value >> ((value >> 28u) + 4u)) ^ value) * 277803737u;
  return f32((value >> 22u) ^ value) / 4294967295.0;
}
fn address(position: vec2f) -> u32 {
  let cell = vec2u(clamp((position / params.grid.z + 0.5) * params.grid.x, vec2f(0.0), vec2f(params.grid.x - 1.0)));
  return cell.y * u32(params.grid.x) + cell.x;
}

fn impactResponse(speed: f32) -> f32 {
  return smoothstep(${d.impactSpeedStart}, ${d.impactSpeedFull}, speed);
}
fn claimImpactMass(cell: u32, requestedMass: f32) -> f32 {
  let requestedUnits = max(1, i32(round(requestedMass * 1e9)));
  let previous = atomicSub(&impactBudget[cell], requestedUnits);
  if (previous <= 0) {
    atomicAdd(&impactBudget[cell], requestedUnits);
    return 0.0;
  }
  let claimed = min(previous, requestedUnits);
  if (claimed < requestedUnits) { atomicAdd(&impactBudget[cell], requestedUnits - claimed); }
  return f32(claimed) * 1e-9;
}
fn cellCenter(cell: u32) -> vec2f {
  return (vec2f(f32(cell % u32(params.grid.x)), f32(cell / u32(params.grid.x))) + 0.5) * params.grid.y - params.grid.z * 0.5;
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
    let impactGrain = grain.velocity.w < 0.0;
    var age = abs(grain.velocity.w);
    if (impactGrain) {
      let radiusScale = pow(max(grain.position.w, 1e-9) / ${d.airborneReferenceMass}, 1.0 / 3.0);
      let dragCoefficient = 2.35 / max(radiusScale, 0.55);
      let speed = length(grain.velocity.xyz);
      let drag = max(0.0, 1.0 - dragCoefficient * speed * params.grid.w);
      grain.velocity = vec4f(grain.velocity.xyz * drag, grain.velocity.w);
    }
    grain.velocity.y -= 9.81 * params.grid.w;
    grain.position = vec4f(grain.position.xyz + grain.velocity.xyz * params.grid.w, grain.position.w);
    age += params.grid.w;
    grain.velocity.w = select(age, -age, impactGrain);
    let limit = params.grid.z * 0.5 - params.grid.y;
    grain.position.x = clamp(grain.position.x, -limit, limit);
    grain.position.z = clamp(grain.position.z, -limit, limit);
    let cell = address(grain.position.xz);
    let surface = contactAt(grain.position.xz);
    if (grain.position.y <= surface.x + 0.00014) {
      let normal = normalize(vec3f(-surface.y, 1.0, -surface.z));
      let normalSpeed = dot(grain.velocity.xyz, normal);
      if (normalSpeed < -0.08 && age < 0.22) {
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
    grain.velocity.w += 1.0;
    let seed = index * 991u + u32(grain.velocity.w);
    var launched = false;
    let contactCount = u32(params.tool.x);
    if (contactCount > 0u) {
      let contactIndex = index % contactCount;
      let tool = params.contacts[contactIndex];
      let toolSpeed = length(tool.motion.xy);
      let toolImpact = impactResponse(toolSpeed);
      if (toolImpact > 0.0) {
        let direction = tool.motion.xy / max(toolSpeed, 1e-8);
        let side = vec2f(-direction.y, direction.x);
        let candidate = index / contactCount;
        let sampleIndex = candidate % 256u;
        let sampleCycle = candidate / 256u;
        let column = sampleIndex % 16u;
        let row = sampleIndex / 16u;
        let forward = (mix(-0.08, 1.08, (f32(column) + random(seed + sampleCycle * 17u + 3u)) / 16.0)) * tool.start.z;
        let lateral = (mix(-1.05, 1.05, (f32(row) + random(seed + sampleCycle * 23u + 11u)) / 16.0)) * tool.start.z;
        let candidatePosition = tool.end.xy + direction * forward + side * lateral;
        let cell = address(candidatePosition);
        let localContact = contactField[cell];
        let localSpeed = length(localContact.zw);
        let localImpact = impactResponse(localSpeed) * contactPressure[cell] * pow(localContact.x, 1.75);
        let requestedMass = mix(${d.impactParticleMassMin}, ${d.impactParticleMassMax}, random(seed + 13u));
        var mass = 0.0;
        if (localImpact > 0.0) { mass = claimImpactMass(cell, requestedMass); }
        if (mass > 0.0) {
          let surfacePosition = cellCenter(cell);
          let surface = contactAt(surfacePosition);
          let motionDirection = localContact.zw / max(localSpeed, 1e-8);
          let transport = fluxVector(flux[cell]);
          let transportDirection = transport / max(length(transport), 1e-9);
          let launchDirection = normalize(motionDirection + transportDirection * 0.28);
          let launchSide = vec2f(-launchDirection.y, launchDirection.x);
          let spread = (random(seed + 31u) - 0.5) * localSpeed * 0.26;
          let horizontalSpeed = localSpeed * (0.42 + random(seed + 5u) * 0.38);
          let horizontal = launchDirection * horizontalSpeed + launchSide * spread;
          let uphill = max(0.0, dot(surface.yz, motionDirection));
          let loft = pow(random(seed + 7u), 2.0);
          let rareBurst = pow(random(seed + 41u), 9.0);
          let lift = 0.12 + localSpeed * (0.16 + loft * 0.45 + rareBurst * 0.62 + min(uphill, 0.8) * 0.30);
          grain.position = vec4f(surfacePosition.x, surface.x + 0.0003, surfacePosition.y, mass);
          grain.velocity = vec4f(horizontal.x, lift, horizontal.y, -1e-6);
          atomicSub(&exchange[cell], i32(round(mass * 1e9)));
          launched = true;
        }
      }
    }
    if (!launched) {
      let stride = max(1u, u32(params.grid.x * params.grid.x) / arrayLength(&grains));
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
      let contactSpeed = length(contactField[cell].zw);
      let activeImpactContact = params.tool.x > 0.0 && contactField[cell].x > 0.001 && impactResponse(contactSpeed) > 0.0;
      if (!activeImpactContact && reserve > mass * 1.2 && random(seed) < launchChance) {
        let position = cellCenter(cell);
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
  }
  grains[index] = grain;
}
`,Ue=`
${K}
struct ResetParams {
  grid: vec4f,
  wave: vec4f,
  band: vec4f,
}
@group(0) @binding(0) var<uniform> params: ResetParams;
@group(0) @binding(1) var<storage, read_write> state: array<vec4f>;

fn hash(position: vec2f) -> f32 {
  return fract(sin(dot(position, vec2f(127.1, 311.7))) * 43758.5453);
}
fn address(cell: vec2u) -> u32 {
  return cell.y * u32(params.grid.x) + cell.x;
}
fn location(cell: vec2u) -> vec2f {
  return (vec2f(cell) + 0.5) * params.grid.y - params.grid.z * 0.5;
}
fn initialHeight(position: vec2f, cell: vec2u) -> f32 {
  return params.grid.w + 0.00015 * (hash(vec2f(cell)) - 0.5)
    + 0.0004 * sin(position.x * 31.0 + sin(position.y * 23.0)) * sin(position.y * 27.0);
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) invocation: vec3u) {
  let cell = vec2u(invocation.x, invocation.y + u32(params.band.x));
  if (cell.x >= u32(params.grid.x) || invocation.y >= u32(params.band.y) || cell.y >= u32(params.grid.x)) { return; }
  let position = location(cell);
  let previousFront = shorelineFront(position.x, params.wave.x, params.wave.z);
  let currentFront = shorelineFront(position.x, params.wave.y, params.wave.w);
  let coveredBefore = position.y >= previousFront;
  let coveredNow = position.y >= currentFront;
  if (!coveredNow || coveredBefore) { return; }
  state[address(cell)] = vec4f(initialHeight(position, cell), 0.0, 0.0, 0.0);
}
`,We=3+d.maxContacts*3,Ge=We*16,Ke=class{buffers;flux;particles;particleCount;exchange;contact;contactPressure;impactBudget;particlePipeline;particleGroups=[];uniforms;waveResetUniform;waveResetPipeline;waveResetGroups=[];pipelines;groups=[];current=0;generation=0;data=new Float32Array(We*4);byteLength;device;resolution;constructor(e,t=d.resolution){this.device=e,this.resolution=t,this.byteLength=t*t*16,this.buffers=[0,1].map(t=>e.createBuffer({label:`Sand state ${t}`,size:this.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST})),this.flux=e.createBuffer({label:`Eight-neighbor conservative flux`,size:this.byteLength*2,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.contact=e.createBuffer({label:`Pointer contact field`,size:this.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.contactPressure=e.createBuffer({label:`Pointer contact pressure`,size:t*t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.impactBudget=e.createBuffer({label:`Frontier impact ejection budget`,size:t*t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.particleCount=Math.min(d.particles,t*t),this.particles=e.createBuffer({label:`Mass carrying grains`,size:this.particleCount*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.exchange=e.createBuffer({label:`Fixed-point grain exchange`,size:t*t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.uniforms=Array.from({length:d.maxSteps},()=>e.createBuffer({size:Ge,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})),this.waveResetUniform=e.createBuffer({label:`Wave reset parameters`,size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}get state(){return this.buffers[this.current]}get stateIndex(){return this.current}get revision(){return this.generation}async initialize(){let e=await z(this.device,`Sand transport WGSL`,Ve),t=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:7,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),n=this.device.createPipelineLayout({bindGroupLayouts:[t]}),r=t=>this.device.createComputePipelineAsync({label:t,layout:n,compute:{module:e,entryPoint:t}}),[i,a,o,s]=await Promise.all([r(`initialize`),r(`contact`),r(`transport`),r(`integrate`)]);this.pipelines={initialize:i,contact:a,transport:o,integrate:s},this.groups=this.uniforms.map(e=>[0,1].map(n=>this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:{buffer:this.buffers[n]}},{binding:2,resource:{buffer:this.buffers[1-n]}},{binding:3,resource:{buffer:this.flux}},{binding:4,resource:{buffer:this.exchange}},{binding:5,resource:{buffer:this.contact}},{binding:6,resource:{buffer:this.contactPressure}},{binding:7,resource:{buffer:this.impactBudget}}]})));let c=await z(this.device,`Mass carrying grains WGSL`,He);this.particlePipeline=await this.device.createComputePipelineAsync({layout:`auto`,compute:{module:c,entryPoint:`animate`}}),this.particleGroups=this.uniforms.map(e=>this.buffers.map(t=>this.device.createBindGroup({layout:this.particlePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:this.flux}},{binding:3,resource:{buffer:this.particles}},{binding:4,resource:{buffer:this.exchange}},{binding:5,resource:{buffer:this.contact}},{binding:6,resource:{buffer:this.contactPressure}},{binding:7,resource:{buffer:this.impactBudget}}]})));let l=await z(this.device,`Wave reset WGSL`,Ue);this.waveResetPipeline=await this.device.createComputePipelineAsync({layout:`auto`,compute:{module:l,entryPoint:`main`}}),this.waveResetGroups=this.buffers.map(e=>this.device.createBindGroup({layout:this.waveResetPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.waveResetUniform}},{binding:1,resource:{buffer:e}}]})),this.reset()}writeParams(e,t){let n=t.filter(e=>e.active&&e.pressure>0).slice(0,d.maxContacts);return this.data.fill(0),this.data.set([this.resolution,d.extent/this.resolution,d.extent,d.step,d.depth,d.floor,d.repose,d.dynamicRepose,n.length,d.indentation,d.rate,0]),n.forEach((e,t)=>{let n=12+t*12;this.data.set([e.from.x,e.from.y,e.radius,e.pressure],n),this.data.set([e.to.x,e.to.y,0,0],n+4),this.data.set([e.velocity.x,e.velocity.y,Math.hypot(e.velocity.x,e.velocity.y),0],n+8)}),this.device.queue.writeBuffer(this.uniforms[e],0,this.data),n.length}reset(){this.writeParams(0,[]);let e=this.device.createCommandEncoder();this.encodeFullReset(e),this.device.queue.submit([e.finish()])}encodeFullReset(e){this.generation++,e.clearBuffer(this.particles),e.clearBuffer(this.exchange),e.clearBuffer(this.impactBudget);let t=e.beginComputePass({label:`Full sand reset`});t.setPipeline(this.pipelines.initialize);for(let e of[this.groups[0][0],this.groups[0][1]])t.setBindGroup(0,e),t.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8));t.end()}encodeWaveReset(e,t){let n=d.extent/this.resolution,r=d.extent*.5,i=r*Math.abs(w.shorelineTilt)+w.shorelineAmplitude*(1+Math.abs(w.shorelineBlend)+.55),a=Math.min(t.erasePreviousBaseFront,t.eraseCurrentBaseFront)-i,o=Math.max(t.erasePreviousBaseFront,t.eraseCurrentBaseFront)+i,s=Math.max(0,Math.min(this.resolution,Math.floor((a+r)/n)-1)),c=Math.max(s,Math.min(this.resolution,Math.ceil((o+r)/n)+1))-s;if(c<=0)return;let l=new Float32Array([this.resolution,n,d.extent,d.depth,t.erasePreviousBaseFront,t.eraseCurrentBaseFront,t.erasePreviousTime,t.eraseCurrentTime,s,c,0,0]);this.device.queue.writeBuffer(this.waveResetUniform,0,l);let u=e.beginComputePass({label:`Wave reset`});u.setPipeline(this.waveResetPipeline);for(let e of this.waveResetGroups)u.setBindGroup(0,e),u.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(c/8));u.end(),this.generation++}clearTransientState(e){e.clearBuffer(this.flux),e.clearBuffer(this.particles),e.clearBuffer(this.exchange),e.clearBuffer(this.contact),e.clearBuffer(this.contactPressure),e.clearBuffer(this.impactBudget)}encode(e,t){if(t.length>d.maxSteps)throw Error(`Simulation substep budget exceeded`);t.forEach((t,n)=>{let r=this.writeParams(n,t),i=e.beginComputePass({label:`Sand conservative transport`});i.setBindGroup(0,this.groups[n][this.current]),r>0&&(i.setPipeline(this.pipelines.contact),i.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8))),i.setPipeline(this.pipelines.transport),i.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8)),i.setPipeline(this.particlePipeline),i.setBindGroup(0,this.particleGroups[n][this.current]),i.dispatchWorkgroups(Math.ceil(this.particleCount/64)),i.setPipeline(this.pipelines.integrate),i.setBindGroup(0,this.groups[n][this.current]),i.dispatchWorkgroups(Math.ceil(this.resolution/8),Math.ceil(this.resolution/8)),i.end(),this.current=1-this.current,this.generation++})}dispose(){[...this.buffers,this.flux,this.particles,this.exchange,this.contact,this.contactPressure,this.impactBudget,...this.uniforms,this.waveResetUniform].forEach(e=>e.destroy())}};async function qe(e,t){let n=await b(e.canvas,t),r=new Ke(n.device),i=new Le(n.device,r,n.format,ie()),a=new u,o=a.prepare(),s=new Re(d.step,d.maxSteps),c=new AbortController,l,p=0,m=!1,h=0,g=!0,_=!1,v=!1,x=!1,S=ae()?1:2,C=new ee,w=t=>{e.reset.disabled=!t,e.radius.disabled=!t,l?.setInteractive(t)},T=()=>{m||(m=!0,cancelAnimationFrame(p),c.abort(),l?.dispose(),a.dispose(),i.dispose(),r.dispose(),n.dispose())};t.setStop(T);let E=()=>{if(!g)return;let t=oe(window.innerWidth,window.innerHeight,window.devicePixelRatio);t&&(g=!1,e.canvas.width=t.width,e.canvas.height=t.height,i.resize(t.width,t.height))};try{t.stage(`Initializing sand transport`),await r.initialize(),t.stage(`Compiling granular lighting`),await i.initialize(),t.stage(`Rendering the first surface`),E();let u=n.device.createCommandEncoder();r.encode(u,[[],[]]),i.encode(u,n.context.getCurrentTexture().createView(),f(),performance.now()),n.device.queue.submit([u.finish()]),await n.device.queue.onSubmittedWorkDone(),t.assertHealthy(),await o,l=new y(e,i.camera,a,()=>{_=!0}),w(!0);let d=e=>{if(m)return;p=requestAnimationFrame(d),a.update(e);let o=v?S:1;if(document.hidden){s.reset();return}if(!(h>=o))try{E(),_&&!v&&(_=!1,v=!0,a.cancelAll(),C.start(e,a.playResetWave(),te(i.camera)),x=!0,s.reset(),w(!1));let o=n.device.createCommandEncoder(),c=l,u=C.update(e);v&&(s.reset(),x&&=(r.clearTransientState(o),!1),u.erase&&r.encodeWaveReset(o,u),u.justFinished&&(v=!1,s.reset(e),w(!0)));let d=v?0:s.advance(e);d>0&&r.encode(o,Array.from({length:d},()=>c.strokes.nextBatch())),i.encode(o,n.context.getCurrentTexture().createView(),c.strokes.cursor,e,c.showPointer,u),n.device.queue.submit([o.finish()]),h++,n.device.queue.onSubmittedWorkDone().then(()=>{h=Math.max(0,h-1)}).catch(e=>t.fail(e))}catch(e){t.fail(e)}};window.addEventListener(`resize`,()=>{g=!0},{signal:c.signal}),window.visualViewport?.addEventListener(`resize`,()=>{g=!0},{signal:c.signal}),document.addEventListener(`visibilitychange`,()=>s.reset(),{signal:c.signal}),window.addEventListener(`pagehide`,T,{once:!0,signal:c.signal}),p=requestAnimationFrame(d)}catch(e){throw T(),e}}export{qe as startSandboard};