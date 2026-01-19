function z(e,s,o){const i=(o==null?void 0:o.preparedBy)||"Hair & Makeup Department",h=(o==null?void 0:o.firstShootDate)||new Date,c=(o==null?void 0:o.lastShootDate)||new Date,a=e.characters.map(t=>{const l=e.looks.filter(m=>m.characterId===t.id);return C(t,l,e.scenes,s)}).join(""),r=e.scenes.sort((t,l)=>t.sceneNumber.localeCompare(l.sceneNumber,void 0,{numeric:!0})).map(t=>k(t,e.characters,e.looks,s)).join(""),n=e.characters.map(t=>`<li><a href="#character-${t.id}">${t.name}</a></li>`).join(""),d=e.scenes.slice(0,20).map(t=>`<li><a href="#scene-${t.id}">Scene ${t.sceneNumber}</a></li>`).join("");return`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${e.name} - Continuity Bible</title>
      <style>
        @media print {
          .page-break { page-break-before: always; }
          .no-print { display: none; }
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          max-width: 900px;
          margin: 0 auto;
          color: #333;
          line-height: 1.5;
        }

        /* Cover Page */
        .cover-page {
          text-align: center;
          padding: 100px 20px;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .cover-title { font-size: 36px; font-weight: bold; color: #C9A962; margin-bottom: 10px; }
        .cover-subtitle { font-size: 24px; color: #666; margin-bottom: 60px; }
        .cover-meta { font-size: 14px; color: #888; }
        .cover-meta p { margin: 8px 0; }

        /* Table of Contents */
        .toc { margin: 40px 0; }
        .toc h2 { color: #C9A962; border-bottom: 2px solid #C9A962; padding-bottom: 8px; }
        .toc ul { list-style: none; padding: 0; }
        .toc li { padding: 4px 0; }
        .toc a { color: #333; text-decoration: none; }
        .toc a:hover { color: #C9A962; }
        .toc-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

        /* Character Section */
        .character-section { margin-bottom: 60px; }
        .character-header {
          background: linear-gradient(135deg, #C9A962, #B8985A);
          color: white;
          padding: 20px;
          border-radius: 8px 8px 0 0;
        }
        .character-name { font-size: 24px; font-weight: bold; margin: 0; }

        /* Look Section */
        .look-section {
          border: 1px solid #ddd;
          border-top: none;
          padding: 20px;
          margin-bottom: 20px;
        }
        .look-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eee;
        }
        .look-name { font-size: 18px; font-weight: 600; color: #333; }
        .look-scenes { font-size: 12px; color: #666; }
        .look-time { font-size: 12px; color: #888; }

        /* Photo Grid */
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin: 15px 0;
        }
        .photo-placeholder {
          aspect-ratio: 3/4;
          background: #f5f5f5;
          border: 1px dashed #ccc;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #999;
        }
        .photo-img {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          border-radius: 4px;
        }
        .master-photo {
          grid-column: span 2;
          grid-row: span 2;
        }
        .master-photo .photo-img,
        .master-photo .photo-placeholder {
          aspect-ratio: auto;
          height: 100%;
        }

        /* Details Tables */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
        }
        .details-section h4 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #C9A962;
          margin: 0 0 10px 0;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
        }
        .details-table {
          width: 100%;
          font-size: 12px;
        }
        .details-table td {
          padding: 4px 0;
          vertical-align: top;
        }
        .details-table td:first-child {
          color: #666;
          width: 45%;
        }
        .details-table td:last-child {
          color: #333;
          font-weight: 500;
        }

        /* Notes */
        .notes-section {
          margin-top: 15px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          font-size: 13px;
        }
        .notes-section h4 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666;
          margin: 0 0 8px 0;
        }

        /* Scene Section */
        .scene-section {
          margin-bottom: 40px;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
        }
        .scene-header {
          background: #f5f5f5;
          padding: 15px;
          border-bottom: 1px solid #ddd;
        }
        .scene-number { font-size: 14px; color: #C9A962; font-weight: bold; }
        .scene-slugline { font-size: 16px; font-weight: 600; color: #333; margin: 5px 0; }
        .scene-synopsis { font-size: 13px; color: #666; }
        .scene-content { padding: 15px; }
        .scene-characters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .scene-character-card {
          flex: 1;
          min-width: 200px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
        }
        .scene-character-name { font-weight: 600; font-size: 14px; }
        .scene-character-look { font-size: 12px; color: #666; }
        .scene-character-page { font-size: 11px; color: #C9A962; }

        /* Continuity Flags */
        .flags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .flag-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
        .flag-sweat { background: #e3f2fd; color: #1565c0; }
        .flag-dishevelled { background: #fff3e0; color: #ef6c00; }
        .flag-blood { background: #ffebee; color: #c62828; }
        .flag-dirt { background: #efebe9; color: #5d4037; }
        .flag-wetHair { background: #e0f7fa; color: #00838f; }
        .flag-tears { background: #e8eaf6; color: #3949ab; }

        /* SFX Section */
        .sfx-section {
          margin-top: 15px;
          padding: 12px;
          background: #fff8e1;
          border: 1px solid #ffe082;
          border-radius: 6px;
        }
        .sfx-section h4 {
          color: #f57c00;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 8px 0;
        }
      </style>
    </head>
    <body>
      <!-- Cover Page -->
      <div class="cover-page">
        <h1 class="cover-title">${e.name}</h1>
        <h2 class="cover-subtitle">Hair & Makeup Continuity Bible</h2>
        <div class="cover-meta">
          <p><strong>Prepared by:</strong> ${i}</p>
          <p><strong>Date Range:</strong> ${$(h)} - ${$(c)}</p>
          <p><strong>Department:</strong> Hair & Makeup</p>
          <p><strong>Total Scenes:</strong> ${e.scenes.length}</p>
          <p><strong>Total Characters:</strong> ${e.characters.length}</p>
        </div>
      </div>

      <div class="page-break"></div>

      <!-- Table of Contents -->
      <div class="toc">
        <h2>Table of Contents</h2>
        <div class="toc-columns">
          <div>
            <h3>Characters</h3>
            <ul>${n}</ul>
          </div>
          <div>
            <h3>Scenes</h3>
            <ul>${d}</ul>
            ${e.scenes.length>20?"<li><em>...and more</em></li>":""}
          </div>
        </div>
      </div>

      <div class="page-break"></div>

      <!-- Character Sections -->
      <h2 style="color: #C9A962; margin-bottom: 30px;">Character Reference</h2>
      ${a}

      <div class="page-break"></div>

      <!-- Scene Sections -->
      <h2 style="color: #C9A962; margin-bottom: 30px;">Scene Index</h2>
      ${r}
    </body>
    </html>
  `}function C(e,s,o,i){const h=s.map(c=>{var d;const a=o.filter(t=>c.scenes.includes(t.sceneNumber)).map(t=>t.sceneNumber).join(", "),r=Object.keys(i).find(t=>t.includes(e.id)&&i[t].lookId===c.id),n=r?i[r]:null;return`
      <div class="look-section">
        <div class="look-header">
          <div>
            <div class="look-name">${c.name}</div>
            <div class="look-scenes">Scenes: ${a||"None assigned"}</div>
          </div>
          <div class="look-time">Application Time: ~${c.estimatedTime} min</div>
        </div>

        <!-- Photos Grid -->
        <div class="photo-grid">
          <div class="master-photo">
            ${c.masterReference?`<img class="photo-img" src="${c.masterReference.uri}" alt="Master Reference" />`:'<div class="photo-placeholder">Master Reference<br/>No Photo</div>'}
          </div>
          ${["front","left","right","back"].map(t=>{const l=n==null?void 0:n.photos[t];return l?`<img class="photo-img" src="${l.uri}" alt="${t}" />`:`<div class="photo-placeholder">${t.charAt(0).toUpperCase()+t.slice(1)}</div>`}).join("")}
        </div>

        <!-- Details -->
        <div class="details-grid">
          <div class="details-section">
            <h4>Makeup</h4>
            <table class="details-table">
              ${w(c.makeup)}
            </table>
          </div>
          <div class="details-section">
            <h4>Hair</h4>
            <table class="details-table">
              ${N(c.hair)}
            </table>
          </div>
        </div>

        ${(d=n==null?void 0:n.sfxDetails)!=null&&d.sfxRequired?`
          <div class="sfx-section">
            <h4>Special Effects</h4>
            <table class="details-table">
              ${T(n.sfxDetails)}
            </table>
          </div>
        `:""}

        ${n!=null&&n.notes?`
          <div class="notes-section">
            <h4>Notes</h4>
            <p>${n.notes}</p>
          </div>
        `:""}
      </div>
    `}).join("");return`
    <div class="character-section" id="character-${e.id}">
      <div class="character-header">
        <h3 class="character-name">${e.name}</h3>
      </div>
      ${h}
    </div>
  `}function k(e,s,o,i){const c=s.filter(a=>e.characters.includes(a.id)).map(a=>{const r=o.find(l=>l.characterId===a.id&&l.scenes.includes(e.sceneNumber)),n=`${e.id}-${a.id}`,d=i[n],t=d?D(d.continuityFlags):"";return`
      <div class="scene-character-card">
        <div class="scene-character-name">${a.name}</div>
        <div class="scene-character-look">${(r==null?void 0:r.name)||"No Look Assigned"}</div>
        ${t?`<div class="flags-list">${t}</div>`:""}
      </div>
    `}).join("");return`
    <div class="scene-section" id="scene-${e.id}">
      <div class="scene-header">
        <div class="scene-number">SCENE ${e.sceneNumber}</div>
        <div class="scene-slugline">${e.intExt}. ${e.slugline} - ${e.timeOfDay}</div>
        ${e.synopsis?`<div class="scene-synopsis">${e.synopsis}</div>`:""}
      </div>
      <div class="scene-content">
        <h4 style="font-size: 12px; color: #666; margin: 0 0 10px;">Characters in Scene:</h4>
        <div class="scene-characters">
          ${c||'<p style="color: #999; font-size: 13px;">No characters assigned</p>'}
        </div>
      </div>
    </div>
  `}function j(e,s){const o=["Scene","INT/EXT","Location","Time","Characters","Looks","Makeup Summary","Hair Summary","SFX","Flags","Notes","Status"],i=e.scenes.sort((a,r)=>a.sceneNumber.localeCompare(r.sceneNumber,void 0,{numeric:!0})).map(a=>{const r=e.characters.filter(p=>a.characters.includes(p.id)),n=r.map(p=>p.name).join("; "),d=r.map(p=>{const u=e.looks.find(f=>f.characterId===p.id&&f.scenes.includes(a.sceneNumber));return u?`${p.name}: ${u.name}`:null}).filter(Boolean).join("; ");let t=[],l=[],m=[],x=[],v=[];return r.forEach(p=>{const u=`${a.id}-${p.id}`,f=s[u],g=e.looks.find(b=>b.characterId===p.id&&b.scenes.includes(a.sceneNumber));if(g&&(g.makeup.foundation&&t.push(g.makeup.foundation),g.makeup.lipColour&&t.push(g.makeup.lipColour),g.hair.style&&l.push(g.hair.style)),f){f.sfxDetails.sfxRequired&&m.push(f.sfxDetails.sfxTypes.join(", "));const b=Object.entries(f.continuityFlags).filter(([y,S])=>S).map(([y])=>y);x.push(...b),f.notes&&v.push(f.notes)}}),[a.sceneNumber.toString(),a.intExt,a.slugline,a.timeOfDay,n,d,[...new Set(t)].join(", "),[...new Set(l)].join(", "),[...new Set(m)].join(", ")||"None",[...new Set(x)].join(", ")||"-",v.join(" | "),a.isComplete?"Complete":"Incomplete"]}),h=a=>a.includes(",")||a.includes('"')||a.includes(`
`)?`"${a.replace(/"/g,'""')}"`:a;return[o.join(","),...i.map(a=>a.map(h).join(","))].join(`
`)}function $(e){return new Date(e).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}function w(e){return[["Foundation",e.foundation],["Coverage",e.coverage],["Concealer",e.concealer],["Blush",e.blush],["Lips",e.lipColour],["Eyes",[e.lidColour,e.liner,e.lashes].filter(Boolean).join(", ")],["Setting",e.setting]].filter(([o,i])=>i).map(([o,i])=>`
    <tr><td>${o}:</td><td>${i}</td></tr>
  `).join("")}function N(e){const s=[["Style",e.style],["Parting",e.parting],["Products",e.products],["Pieces Out",e.piecesOut],["Accessories",e.accessories],["Type",e.hairType!=="Natural"?e.hairType:null]].filter(([o,i])=>i);return e.hairType!=="Natural"&&(e.wigNameId&&s.push(["Wig",e.wigNameId]),e.wigType&&s.push(["Wig Type",e.wigType])),s.map(([o,i])=>`
    <tr><td>${o}:</td><td>${i}</td></tr>
  `).join("")}function T(e){return[["Types",e.sfxTypes.join(", ")],["Prosthetics",e.prostheticPieces],["Adhesive",e.prostheticAdhesive],["Blood Types",e.bloodTypes.join(", ")],["Blood Products",e.bloodProducts],["Contact Lenses",e.contactLenses],["Teeth",e.teeth]].filter(([o,i])=>i&&i.length>0).map(([o,i])=>`
    <tr><td>${o}:</td><td>${i}</td></tr>
  `).join("")}function D(e){const s=[];return e.sweat&&s.push('<span class="flag-badge flag-sweat">Sweat</span>'),e.dishevelled&&s.push('<span class="flag-badge flag-dishevelled">Dishevelled</span>'),e.blood&&s.push('<span class="flag-badge flag-blood">Blood</span>'),e.dirt&&s.push('<span class="flag-badge flag-dirt">Dirt</span>'),e.wetHair&&s.push('<span class="flag-badge flag-wetHair">Wet Hair</span>'),e.tears&&s.push('<span class="flag-badge flag-tears">Tears</span>'),s.join("")}export{z as generateContinuityBiblePDF,j as generateSceneBreakdownCSV};
