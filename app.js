(function(){
  'use strict';
  console.info('[PitchLab 21] build 2026-10-17-pesmaster-player-catalog-3');
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  // Use var to avoid the temporal-dead-zone failure seen when a stale/partial build
  // reaches player normalization before the catalog initializer has executed.
  // The empty Map is safe as a fallback; it is populated from the bundled catalog below.
  var LEAGUE_CANONICAL_BY_KEY = new Map();
  const STORAGE_PLAYERS='pitchlab21-imported-players-v2';
  const STORAGE_SQUAD='pitchlab21-saved-squad-v1';
  const STORAGE_COACHES='pitchlab21-coaches-v1';
  const STORAGE_MASTER_LEAGUE='pitchlab21-master-league-v1';
  const IDB_NAME='pitchlab21-database-v1', IDB_STORE='datasets', IDB_PLAYERS_KEY='active-players', IDB_PLAYERS_META_KEY='active-players-meta-v2', IDB_PLAYERS_CHUNK_PREFIX='active-players-chunk-v2-';
  const OPENML_ARFF_URL='https://www.openml.org/data/v1/download/22102474/efootball-pes2021-all-players-csv.arff';
  const OPENML_DATA_URL='https://www.openml.org/d/43649';
  const PESMASTER_SEARCH_URL='https://www.pesmaster.com/pes-2021/search/';
  // Public community catalog based on PES 2021 VirtuaRED patch v10.2; cached locally after download.
  const COMMUNITY_DATA_URL='https://raw.githubusercontent.com/xyzsteven/PESXplorer/main/players.json';
  const COMMUNITY_ASSET_BASE='https://raw.githubusercontent.com/xyzsteven/PESXplorer/main/';
  const COMMUNITY_SOURCE_URL='https://github.com/xyzsteven/PESXplorer';
  const ATTRS = [
    ['Attacking',[['offensiveAwareness','Offensive Awareness'],['ballControl','Ball Control'],['dribbling','Dribbling'],['tightPossession','Tight Possession'],['lowPass','Low Pass'],['loftedPass','Lofted Pass'],['finishing','Finishing'],['heading','Heading'],['placeKicking','Place Kicking'],['curl','Curl'],['weakFootUsage','Weak Foot Usage'],['weakFootAccuracy','Weak Foot Accuracy']]],
    ['Physical',[['speed','Speed'],['acceleration','Acceleration'],['kickingPower','Kicking Power'],['jump','Jump'],['physicalContact','Physical Contact'],['balance','Balance'],['stamina','Stamina'],['form','Form'],['injuryResistance','Injury Resistance']]],
    ['Defending',[['defensiveAwareness','Defensive Awareness'],['ballWinning','Ball Winning'],['aggression','Aggression']]],
    ['Goalkeeping',[['gkAwareness','GK Awareness'],['gkCatching','GK Catching'],['gkClearing','GK Clearing'],['gkReflexes','GK Reflexes'],['gkReach','GK Reach']]],
  ];
  const ATTR_LABELS = Object.fromEntries(ATTRS.flatMap(g=>g[1].map(a=>[a[0],a[1]])));
  const ATTR_BY_SLUG = Object.fromEntries(ATTRS.flatMap(g=>g[1]).flatMap(([key,label])=>[[key.replace(/[^a-z0-9]/gi,'').toLowerCase(),key],[label.replace(/[^a-z0-9]/gi,'').toLowerCase(),key]]));
  const PLAYER_FIELD_ALIASES = {playername:'name',fullname:'name',displayname:'displayName',mainposition:'position',primaryposition:'position',registeredposition:'position',positionname:'position',position:'position',overallrating:'overall',rating:'overall',overall:'overall',potentialrating:'potential',heightcm:'height',weightkg:'weight',country:'nationality',countryname:'nationality',nation:'nationality',nationalityname:'nationality',nationality:'nationality',clubname:'club',teamname:'club',team:'club',club:'club',leaguename:'league',competitionname:'league',competition:'league',league:'league',strongerfoot:'foot',preferredfoot:'foot',foot:'foot',style:'playingStyle',playstyle:'playingStyle',playingstyle:'playingStyle',playingstylename:'playingStyle',secondarypositions:'secondaryPositions',playerid:'id',pesmasterid:'portraitId',pesmasterplayerid:'portraitId',portraitid:'portraitId',portraiturl:'portraitUrl',playerimageurl:'portraitUrl',faceurl:'portraitUrl',teamid:'teamId',clubid:'clubId',leagueid:'leagueId',competitionid:'competitionId',teamlogoid:'teamLogoId',pesmasterteamid:'pesmasterTeamId',pesmasterteamlogoid:'teamLogoId',pesmasterclubid:'pesmasterTeamId',leaguelogoid:'leagueLogoId',pesmasterleagueid:'pesmasterLeagueId',pesmasterleaguelogoid:'leagueLogoId',teamemblemurl:'teamLogoUrl',teamlogourl:'teamLogoUrl',leagueemblemurl:'leagueLogoUrl',leaguelogourl:'leagueLogoUrl',countryflagurl:'flagUrl',flagurl:'flagUrl',sourceurl:'sourceUrl',comstyles:'comPlayingStyles',complayingstyles:'comPlayingStyles',weakfootusage:'weakFootUsage',weakfootaccuracy:'weakFootAccuracy',injuryresistance:'injuryResistance',formrating:'form',form:'form',age:'age',height:'height',weight:'weight'};
  const ALL_ATTRS = ATTRS.flatMap(g=>g[1]);
  const ALL_ATTR_KEYS = ALL_ATTRS.map(([key,label])=>({key,label}));
  const POSITIONS=['GK','CB','LB','RB','DMF','CMF','LMF','RMF','AMF','LWF','RWF','SS','CF'];
  // Formation entries are [position, horizontal %, vertical %] coordinates on the pitch.
  // Keep all formations at eleven slots so saved squad indices remain predictable.
  const FORMATIONS={
    '4-3-3':[['GK',50,91],['LB',15,73],['CB',38,76],['CB',62,76],['RB',85,73],['DMF',50,59],['CMF',33,47],['CMF',67,47],['LWF',19,25],['CF',50,20],['RWF',81,25]],
    '4-2-3-1':[['GK',50,91],['LB',15,73],['CB',38,76],['CB',62,76],['RB',85,73],['DMF',39,61],['DMF',61,61],['AMF',50,43],['LWF',20,29],['CF',50,20],['RWF',80,29]],
    '4-4-2':[['GK',50,91],['LB',15,73],['CB',38,76],['CB',62,76],['RB',85,73],['LMF',17,48],['CMF',39,53],['CMF',61,53],['RMF',83,48],['CF',37,24],['CF',63,24]],
    '3-5-2':[['GK',50,91],['CB',24,76],['CB',50,79],['CB',76,76],['LMF',13,49],['CMF',35,54],['DMF',50,61],['CMF',65,54],['RMF',87,49],['CF',37,24],['CF',63,24]],
    '3-4-3':[['GK',50,91],['CB',24,76],['CB',50,79],['CB',76,76],['LMF',15,50],['CMF',39,55],['CMF',61,55],['RMF',85,50],['LWF',20,26],['CF',50,20],['RWF',80,26]],
    '5-3-2':[['GK',50,91],['LB',12,69],['CB',31,76],['CB',50,79],['CB',69,76],['RB',88,69],['CMF',31,51],['DMF',50,58],['CMF',69,51],['CF',37,24],['CF',63,24]]
  };
  const COMMON_SKILLS=['Double Touch','Through Passing','One-touch Pass','Long Range Shooting','Interception','Man Marking','Super-sub','Fighting Spirit','First-time Shot','Weighted Pass','Pinpoint Crossing','Sliding Tackle','Acrobatic Finishing','Long Range Drive','Gamesmanship','Track Back'];
  const FLAGS={Argentina:'🇦🇷',England:'🏴',Sweden:'🇸🇪',Portugal:'🇵🇹',Norway:'🇳🇴',Senegal:'🇸🇳',Brazil:'🇧🇷',Germany:'🇩🇪',Czechia:'🇨🇿',Ghana:'🇬🇭',France:'🇫🇷',Italy:'🇮🇹',Scotland:'🏴',Poland:'🇵🇱',Türkiye:'🇹🇷',Japan:'🇯🇵',Croatia:'🇭🇷',Tunisia:'🇹🇳',Denmark:'🇩🇰',Ireland:'🇮🇪',Serbia:'🇷🇸',Mali:'🇲🇱',Nigeria:'🇳🇬',Wales:'🏴'};
  const I18N={
    'Home':'الرئيسية','Players':'اللاعبون','Advanced Search':'البحث المتقدم','Compare':'مقارنة','Teams':'الأندية','Leagues':'الدوريات','Squad Builder':'بناء التشكيلة','Import Data':'استيراد البيانات','PES 2021 DATABASE':'قاعدة بيانات PES 2021','Find your next signing':'اكتشف لاعبك القادم','Search players, clubs or positions…':'ابحث عن لاعب أو نادٍ أو مركز…','Search':'بحث','Open database':'افتح قاعدة اللاعبين','Compare players':'قارن اللاعبين','Build a squad':'كوّن تشكيلة','Browse teams':'تصفح الأندية','Explore leagues':'اكتشف الدوريات','Import data':'استيراد البيانات','Featured players':'لاعبون مميزون','Top-rated players from PESMASTER PES 2021':'أعلى التقييمات في عينة PES 2021','Player Database':'قاعدة بيانات اللاعبين','Search and filter the PES 2021 player pool.':'ابحث وفلتر بيانات لاعبي PES 2021.','Filters':'الفلاتر','Apply Filters':'تطبيق الفلاتر','Clear Filters':'مسح الفلاتر','Reset':'إعادة ضبط','Download CSV':'تنزيل CSV','Card View':'عرض البطاقات','Table View':'عرض الجدول','players found':'لاعبين مطابقين','Compare Selected':'قارن المحددين','No players found':'لا توجد نتائج','Potential':'الإمكانات','Nationality':'الجنسية','Club':'النادي','League':'الدوري','Position':'المركز','Overall':'التقييم','Age':'العمر','Height':'الطول','Stronger foot':'القدم المفضلة','Playing style':'أسلوب اللعب','Add Player':'إضافة لاعب','Remove':'إزالة','Save Squad':'حفظ التشكيلة','Load Squad':'تحميل التشكيلة','Clear Squad':'مسح التشكيلة','Data Import':'استيراد البيانات','Import CSV / JSON':'استيراد CSV / JSON','Use your own PES 2021 dataset':'استخدم قاعدة بيانات PES 2021 الخاصة بك','Back to search':'العودة للبحث','Compare this player':'قارن اللاعب','Player profile':'ملف اللاعب','Potential rating':'تقييم الإمكانات','Demo data':'بيانات تجريبية','Data source':'مصدر البيانات','Average rating':'متوسط التقييم','Players in squad':'عدد اللاعبين','Formation':'الخطة','Select a player':'اختار لاعب','No squad saved yet':'لا توجد تشكيلة محفوظة','Coaches':'المدربون','Team Tactics':'تكتيكات الفرق','Browse PES 2021 managers and their in-game tactical presets.':'تصفح مدربي PES 2021 وإعداداتهم التكتيكية داخل اللعبة.','Explore default team tactics from the PES 2021 coach database.':'استكشف تكتيكات الفرق الافتراضية حسب قاعدة بيانات مدربي PES 2021.','Search coaches by name, team, or formation…':'ابحث عن مدرب أو فريق أو خطة…','Search teams or tactical styles…':'ابحث عن فريق أو أسلوب تكتيكي…','All attacking styles':'كل أساليب الهجوم','Possession Game':'الاستحواذ على الكرة','Counter Attack':'الهجمات المرتدة','All teams':'كل الفرق','Formation':'الخطة','Adaptability':'التأقلم','Management Skills':'قدرات الإدارة','Team':'الفريق','Nationality':'الجنسية','Attack settings':'إعدادات الهجوم','Defence settings':'إعدادات الدفاع','Attacking style':'أسلوب الهجوم','Build up':'بناء اللعب','Attacking area':'منطقة الهجوم','Positioning':'التمركز','Support range':'نطاق الدعم','Defensive style':'أسلوب الدفاع','Containment area':'منطقة الاحتواء','Pressuring':'الضغط','Defensive line':'خط الدفاع','Compactness':'التماسك','Advanced instructions':'التعليمات المتقدمة','Attacking tactic':'التكتيك الهجومي','Defensive tactic':'التكتيك الدفاعي','Attacking Fullbacks':'ظهيران مهاجمان','Gegenpress':'ضغط معاكس','Attack group':'إعدادات الهجوم','Defence group':'إعدادات الدفاع','Custom Liverpool settings':'إعدادات ليفربول المخصصة','Liverpool settings supplied by you. They are shown as your chosen setup, not as verified original hidden PESMASTER values.':'إعدادات ليفربول دي القيم اللي انت حددتها، ومعروضة كإعداداتك المخصصة وليست قيمًا أصلية مخفية مؤكدة من PESMASTER.','Source profile':'صفحة المصدر','Open source':'افتح المصدر','View team tactics':'عرض تكتيكات الفريق','View coach':'عرض المدرب','Tactical profile':'الملف التكتيكي','Default PES 2021 settings':'إعدادات PES 2021 الافتراضية','No values invented':'لا توجد قيم مختلقة','Tactical presets are in-game database values, not a claim that every real match uses the exact same setup.':'الإعدادات المعروضة هي قيم قاعدة بيانات اللعبة، وليست ادعاءً بأن المدرب يستخدم الخطة نفسها في كل مباراة حقيقية.','The source does not publish these hidden values, so they are left blank rather than guessed.':'المصدر لا ينشر هذه القيم، لذلك تُترك بدون رقم بدل التخمين.','Coach records':'سجلات المدربين','Teams with tactical data':'فرق لها بيانات تكتيكية','Official game profile':'ملف داخل قاعدة اللعبة','Data caveat':'تنبيه بخصوص البيانات','Back':'رجوع','Source profile linked':'رابط المصدر موجود','Source profile':'صفحة المصدر','Open source':'افتح المصدر','Source profile linked':'رابط المصدر موجود'};
  I18N['Master League']='المستر ليج';
  const tr=(v)=>state.lang==='ar'?(I18N[v]||v):v;
  const defaultFilters=()=>({q:'',nationality:'',club:'',league:'',positions:[],minOverall:'',maxOverall:'',minPotential:'',maxAge:'',minAge:'',minHeight:'',maxHeight:'',foot:'',style:'',skill:'',attribute:'',minAttribute:''});
  // Populate the already-initialized lookup before normalizing saved/initial players.
  // A failed/missing catalog now degrades to raw display names instead of crashing startup.
  LEAGUE_CANONICAL_BY_KEY.clear();
  (Array.isArray(window.PITCHLAB_LEAGUE_CATALOG) ? window.PITCHLAB_LEAGUE_CATALOG : []).forEach(label=>{
    const key=assetKey(label); if(key) LEAGUE_CANONICAL_BY_KEY.set(key,label);
  });
  const state={
    lang:localStorage.getItem('pitchlab21-lang')||'en',
    players:[], imported:false, fullDatabaseStatus:'idle', fullDatabaseLoading:false, route:{page:'home',params:[]}, selectedIds:new Set(),
    downloadProgress:{phase:'idle',percent:0,detail:'',bytes:0,total:0}, filters:defaultFilters(), page:1, pageSize:15, sortKey:'overall', sortDir:'desc', view:'table',
      teamPosition:'ALL', teamQuery:'', teamsPage:1, teamsPageSize:48, leagueTeamsPage:1, rosterPage:1, rosterPageSize:50, compareQuery:'', filterTimer:null, progressHideTimer:null, formation:'4-3-3', squad:{}, activeSlot:null, pickerOpen:false, pickerPage:0, pickerSearch:'', coachQuery:'', tacticQuery:'', tacticStyle:'ALL', toastTimer:null, playerCatalogPromise:null, playerCatalogKickTimer:null, teamCatalogPromise:null, teamCatalogKickTimer:null, teamCatalogScriptLoaded:false, teamCatalogScriptFailed:false, coachDataPromise:null, coachDataKickTimer:null, coachDataScriptLoaded:false, coachDataScriptFailed:false, masterLeagueCampaign:null, masterLeagueLeagueId:'', masterLeagueTeamId:'', officialTeams:[], officialLeagues:[], officialCatalogStatus:{status:'idle',phase:'Not started',leagueCount:0,leaguesProcessed:0,teamCount:0,emptyLeagueIds:[],error:''}, officialTeamAliases:new Map(), officialTeamsById:new Map(), officialCatalogPollTimer:null, officialRosters:new Map(), officialRosterLoading:new Set(), officialRosterErrors:new Map(), officialPlayerProfiles:new Map(), officialPlayerLoading:new Set(), officialPlayerErrors:new Map(), localApiReady:null
  };
  try { const savedCareer=JSON.parse(localStorage.getItem(STORAGE_MASTER_LEAGUE)||'null');if(savedCareer&&savedCareer.version===1&&Array.isArray(savedCareer.schedule)&&Array.isArray(savedCareer.results))state.masterLeagueCampaign=savedCareer; } catch(e){}
  try { const imported=localStorage.getItem(STORAGE_PLAYERS); if(imported){const parsed=JSON.parse(imported);if(Array.isArray(parsed)&&parsed.length){state.players=parsed.map((p,i)=>normalizePlayer(p,i));state.imported=true;}} } catch(e){}
   if(!state.players.length) state.players=(window.PITCHLAB_INITIAL_PLAYERS||[]).map(p=>normalizePlayer(p));
  let dataIndex = {unique:{}, playersByClub:new Map(), playersByLeague:new Map(), playerById:new Map(), playerByPesmasterId:new Map(), teamAssets:new Map(), leagueAssets:new Map(), flagAssets:new Map(), clubStats:new Map(), leagueStats:new Map(), topPlayers:[], youngPlayers:[], playersByName:[], uniqueSkills:[]};
  rebuildDataIndexes();
  async function rebuildDataIndexes(){
    const idx={unique:{},playersByClub:new Map(),playersByLeague:new Map(),playerById:new Map(),playerByPesmasterId:new Map(),teamAssets:new Map(),leagueAssets:new Map(),flagAssets:new Map(),clubStats:new Map(),leagueStats:new Map(),topPlayers:[],youngPlayers:[],playersByName:[],uniqueSkills:[]};
    const keyNames=['club','league','nationality','foot','position','playingStyle']; const sets=Object.fromEntries(keyNames.map(k=>[k,new Set()]));
    const add=(map,key,p)=>{if(!key)return;let list=map.get(key);if(!list){list=[];map.set(key,list);}list.push(p);};
    const yieldIndexing=state.players.length>1500;
    for(let playerIndex=0;playerIndex<state.players.length;playerIndex++){
      const p=state.players[playerIndex];
      idx.playerById.set(String(p.id),p);
      if(p.pesmasterPlayerId&&!idx.playerByPesmasterId.has(String(p.pesmasterPlayerId)))idx.playerByPesmasterId.set(String(p.pesmasterPlayerId),p);
      add(idx.playersByClub,p.club,p); add(idx.playersByLeague,p.league,p);
      for(const key of keyNames){const v=p[key];if(v&&v!=='Unknown'&&v!=='Unassigned')sets[key].add(v);}
      if(p.club&&(p.teamLogoUrl||p.teamLogoId||p.pesmasterTeamId||p.teamId||p.clubId||p.sourceUrl)&&!idx.teamAssets.has(p.club))idx.teamAssets.set(p.club,{teamLogoUrl:p.teamLogoUrl||'',teamLogoId:p.teamLogoId||'',pesmasterTeamId:p.pesmasterTeamId||'',teamId:p.teamId||'',clubId:p.clubId||'',sourceUrl:p.sourceUrl||''});
      if(p.league&&(p.leagueLogoUrl||p.leagueLogoId||p.pesmasterLeagueId||p.leagueId||p.competitionId||p.sourceUrl)&&!idx.leagueAssets.has(p.league))idx.leagueAssets.set(p.league,{leagueLogoUrl:p.leagueLogoUrl||'',leagueLogoId:p.leagueLogoId||'',pesmasterLeagueId:p.pesmasterLeagueId||'',leagueId:p.leagueId||'',competitionId:p.competitionId||'',sourceUrl:p.sourceUrl||''});
      if(p.nationality&&p.flagUrl&&!idx.flagAssets.has(p.nationality))idx.flagAssets.set(p.nationality,p.flagUrl);
      if(yieldIndexing&&playerIndex>0&&playerIndex%750===0)await yieldToBrowser();
    }
    for(const key of keyNames)idx.unique[key]=[...sets[key]].sort((a,b)=>String(a).localeCompare(String(b)));
    for(const [club,list] of idx.playersByClub){const rated=list.map(p=>p.overall).filter(v=>Number.isFinite(Number(v))&&v!==null).map(Number);idx.clubStats.set(club,{count:list.length,league:list.find(p=>p.league)?.league||'—',average:rated.length?Math.round(rated.reduce((a,b)=>a+b,0)/rated.length):null});}
    for(const [league,list] of idx.playersByLeague)idx.leagueStats.set(league,{players:list.length,clubs:new Set(list.map(p=>p.club).filter(Boolean)).size});
    idx.topPlayers=state.players.slice().sort((a,b)=>(b.overall||0)-(a.overall||0)).slice(0,5);
    // Keep indexing cheap during startup. The comparison picker searches this array and only
    // displays up to 60 matches, so sorting every record here adds work without helping routing.
    idx.playersByName=state.players.slice();
    const skills=new Set();for(const p of state.players)for(const skill of (p.skills||[]))if(skill)skills.add(skill);idx.uniqueSkills=[...skills].sort((a,b)=>a.localeCompare(b));
    idx.youngPlayers=state.players.filter(p=>p.age!==null&&p.age<=23&&p.potential!==null).sort((a,b)=>(b.potential||0)-(a.potential||0)).slice(0,3);
    dataIndex=idx;
  }
  function canonicalizePlayer(raw){
    const p={...raw};
    let nested=raw.attributes;
    if(typeof nested==='string'){try{nested=JSON.parse(nested)}catch(e){nested={}}}
    const attrs={...(nested&&typeof nested==='object'?nested:{})};
    const attrBySlug=ATTR_BY_SLUG;
    const aliases=PLAYER_FIELD_ALIASES;
    for(const [key,value] of Object.entries(raw)){
      const slug=key.replace(/[^a-z0-9]/gi,'').toLowerCase();
      if(attrBySlug[slug]) attrs[attrBySlug[slug]]=value;
      else if(aliases[slug]) p[aliases[slug]]=value;
      else if(['skills','complayingstyles','attributes'].includes(slug)){if(slug==='skills')p.skills=value;else if(slug==='complayingstyles')p.comPlayingStyles=value;}
    }
    p.attributes=attrs;
    if(p.portraitUrl) p.portraitUrl=resolveCommunityAsset(p.portraitUrl);
    if(p.teamLogoUrl) p.teamLogoUrl=resolveCommunityAsset(p.teamLogoUrl);
    if(p.leagueLogoUrl) p.leagueLogoUrl=resolveCommunityAsset(p.leagueLogoUrl);
    if(p.flagUrl) p.flagUrl=resolveCommunityAsset(p.flagUrl);
    return p;
  }
  function resolveCommunityAsset(value){
    const raw=String(value||'').trim(); if(!raw) return '';
    if(/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
    return COMMUNITY_ASSET_BASE+raw.replace(/^\.\//,'').replace(/^\//,'');
  }
  function normalizePlayer(p, index=0){
    p = canonicalizePlayer(p||{});
    const attrs={};
    const nestedAttrs=p.attributes&&typeof p.attributes==='object'?p.attributes:{};
    const findAttribute=(source,key)=>{
      const label=ATTR_LABELS[key]||key;
      const accepted=new Set([key,label,`${key}Rating`,`${label} Rating`].map(normalizeSlug));
      const match=Object.entries(source||{}).find(([name,value])=>accepted.has(normalizeSlug(name))&&value!==undefined&&value!==null&&value!=='');
      return match?.[1];
    };
    ALL_ATTRS.forEach(([key])=>{
      let v=nestedAttrs[key]; if(v===undefined || v===null || v==='') v=findAttribute(nestedAttrs,key);
      if(v===undefined || v===null || v==='') v=p[key];
      if(v===undefined || v===null || v==='') v=findAttribute(p,key);
      attrs[key]=(v===undefined||v===null||v==='')?null:Number(v);
      if(Number.isNaN(attrs[key])) attrs[key]=null;
    });
    const rawName=p.name||p.displayName||p.player_name||p.full_name||`Imported Player ${index+1}`;
    const rawClub=p.club||p.team||'unassigned';
    const rawPosition=p.position||p.mainPosition||'CMF';
    const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const id=String(p.id||p.playerId||(`import-${slug(rawName)}-${slug(rawClub)}-${slug(rawPosition)}`));
    return {
      ...p,id,name:String(rawName),displayName:String(p.displayName||p.name_display||rawName),
      position:String(p.position||p.mainPosition||'CMF').toUpperCase(),secondaryPositions:Array.isArray(p.secondaryPositions)?p.secondaryPositions:(String(p.secondaryPositions||'').split(/[;,|]/).filter(Boolean)),
      overall:num(p.overall??p.rating??p.Overall),potential:num(p.potential??p.Potential),age:num(p.age??p.Age),height:num(p.height??p.Height),weight:num(p.weight??p.Weight),
      nationality:String(p.nationality||p.country||p.Nationality||'Unknown'),club:String(p.club||p.team||p.Club||'Unassigned'),league:canonicalLeagueName(p.league||p.League||'Unassigned'),foot:String(p.foot||p.strongerFoot||p.Foot||''),
      playingStyle:String(p.playingStyle||p.playing_style_name||p.style||p.PlayingStyle||''),weakFootUsage:num(p.weakFootUsage??p.weak_foot_usage),weakFootAccuracy:num(p.weakFootAccuracy??p.weak_foot_acc),form:num(p.form),injuryResistance:num(p.injuryResistance??p.injury_resistance),
      portraitUrl:resolveCommunityAsset(p.portraitUrl||p.player_image_url||''),portraitFallbackUrl:resolveCommunityAsset(p.portraitFallbackUrl||''),teamLogoUrl:resolveCommunityAsset(p.teamLogoUrl||p.team_emblem_url||''),leagueLogoUrl:resolveCommunityAsset(p.leagueLogoUrl||p.league_emblem_url||''),flagUrl:resolveCommunityAsset(p.flagUrl||p.country_flag_url||''),
      skills:Array.isArray(p.skills)?p.skills:String(p.skills||'').split(/[;,|]/).filter(Boolean),comPlayingStyles:Array.isArray(p.comPlayingStyles)?p.comPlayingStyles:String(p.comPlayingStyles||'').split(/[;,|]/).filter(Boolean),attributes:attrs,dataStatus:p.dataStatus||'IMPORTED'
    };
  }
  function canonicalLeagueName(value){
    const raw=String(value||'Unassigned').trim()||'Unassigned';
    const key=assetKey(raw);
    if(['ligue 1 conforama','(1) ligue 1 conforama','ligue 1 uber eats','french league','france league'].includes(key)) return 'Ligue 1 Conforama';
    if(['other european teams','other european leagues','other european clubs'].includes(key)) return 'Other European Leagues';
    // Map punctuation/diacritic variants (for example Domino's vs Domino’s) to the exact
    // display label from the bundled PESMASTER league index.
    return (LEAGUE_CANONICAL_BY_KEY instanceof Map ? LEAGUE_CANONICAL_BY_KEY.get(key) : null)||raw;
  }
  function num(v){if(v===undefined||v===null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(v,suffix=''){return v===null||v===undefined||v===''?'—':`${esc(v)}${suffix}`;}
  function initials(name){return String(name||'PL').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()||'PL';}
  function assetKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
  function findAssetByName(map,name){if(!map)return null;const exact=map.get(String(name||''));if(exact)return exact;const key=assetKey(name);for(const [label,value] of map.entries())if(assetKey(label)===key)return value;return null;}
  function uniqueAssetUrls(values){return [...new Set((values||[]).map(v=>String(v||'').trim()).filter(v=>/^https?:\/\//i.test(v)))];}
  function teamFileCandidates(file){if(!file)return[];const f=String(file).replace(/^\/+/, '');if(!/^e_\d{3,6}(?:_w)?\.png$/i.test(f))return[];const out=[`https://www.pesmaster.com/pes-2021/graphics/teamlogos/${f}`];if(/_w\.png$/i.test(f))out.push(`https://www.pesmaster.com/pes-2021/graphics/teamlogos/${f.replace(/_w\.png$/i,'.png')}`);else out.push(`https://www.pesmaster.com/pes-2021/graphics/teamlogos/${f.replace(/\.png$/i,'_w.png')}`);return out;}
  function teamIdFiles(value){const raw=String(value??'').trim();if(!raw)return[];const file=raw.match(/^(e_\d{3,6}(?:_w)?\.png)$/i);if(file)return teamFileCandidates(file[1]);const m=raw.match(/(?:^|\/)(?:team\/)?(\d+)(?:\/?$)/i)||raw.match(/^(\d+)$/);if(!m)return[];const id=String(m[1]);if(!/^\d{1,6}$/.test(id))return[];return teamFileCandidates(`e_${id.padStart(6,'0')}.png`);}
  function staticTeamEntry(name){const key=assetKey(name);for(const [league,items] of Object.entries(window.PITCHLAB_STATIC_TEAMS_BY_LEAGUE||{})){for(const item of items||[])if(assetKey(item.name)===key)return {...item,league};}return null;}
  function officialTeamForName(name){
    const key=assetKey(name); if(!key)return null;
    // Prefer an exact official display/source name before aliases. Alias-only lookup can
    // otherwise select a different team when a licensed and unlicensed name collide.
    const exact=(state.officialTeams||[]).find(t=>assetKey(t.name)===key||assetKey(t.sourceName)===key);
    return exact||state.officialTeamAliases.get(key)||null;
  }
  function officialTeamsForLeague(name){
    const target=canonicalLeagueName(name);
    const sourceLeague=(state.officialLeagues||[]).find(l=>canonicalLeagueName(l.name)===target);
    const sourceId=sourceLeague?.leagueId;
    const fallbackId=(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{})[target];
    return state.officialTeams.filter(t=>(t.leagues||[]).some(l=>canonicalLeagueName(l.name)===target ||
      (sourceId!==undefined&&String(l.leagueId)===String(sourceId)) ||
      (!sourceLeague&&fallbackId!==undefined&&Number(l.leagueId)===Number(fallbackId))));
  }
  function playersForClubName(name,teamOverride=null){
    const direct=dataIndex.playersByClub.get(name)||[]; const official=teamOverride||officialTeamForName(name);
    if(!official)return direct;
    const aliasKeys=new Set([official.name,official.sourceName,official.slug,...(official.aliases||[])].filter(Boolean).map(assetKey));
    const out=[];const seen=new Set();
    for(const [club,players] of dataIndex.playersByClub){if(!aliasKeys.has(assetKey(club)))continue;for(const p of players){const id=String(p.id);if(!seen.has(id)){seen.add(id);out.push(p);}}}
    return out;
  }
  function teamSourceUrl(name){return officialTeamForName(name)?.sourceUrl||staticTeamEntry(name)?.sourceUrl||'';}
  function buildOfficialTeamAliasIndex(teams){
    const aliases=new Map(),byId=new Map();
    for(const raw of teams||[]){if(!raw||!raw.teamId)continue;const id=String(raw.teamId);let entry=byId.get(id);
      if(!entry){entry={...raw,teamId:id,aliases:Array.from(new Set([raw.name,raw.sourceName,raw.slug,...(raw.aliases||[])].filter(Boolean))),leagues:Array.isArray(raw.leagues)?raw.leagues.slice():[]};byId.set(id,entry);}
      else {entry.aliases=Array.from(new Set([...entry.aliases,raw.name,raw.sourceName,raw.slug,...(raw.aliases||[])].filter(Boolean)));for(const l of raw.leagues||[])if(!entry.leagues.some(x=>String(x.leagueId)===String(l.leagueId)))entry.leagues.push(l);}
    }
    for(const entry of byId.values())for(const label of entry.aliases)if(assetKey(label)&&!aliases.has(assetKey(label)))aliases.set(assetKey(label),entry);
    state.officialTeamAliases=aliases;state.officialTeamsById=byId;state.officialTeams=[...byId.values()];
  }
  function applyBundledTeamCatalog(){
    const catalog=window.PITCHLAB_PESMASTER_TEAM_CATALOG;
    if(Array.isArray(catalog?.teams)&&Array.isArray(catalog?.leagues)){
      buildOfficialTeamAliasIndex(catalog.teams);state.officialLeagues=catalog.leagues;
      state.officialCatalogStatus={status:catalog.partial?'partial':'complete',phase:'Loaded bundled PESMASTER team catalogue',leagueCount:catalog.leagueCount||catalog.leagues.length,leaguesProcessed:catalog.coverage?.successfulLeaguePages||catalog.leagues.length,teamCount:catalog.teamCount||catalog.teams.length,emptyLeagueIds:catalog.emptyLeagueIds||[],updatedAt:catalog.generatedAt||'',error:''};
      state.teamCatalogScriptLoaded=true;state.teamCatalogScriptFailed=false;return;
    }
    const fallback=Object.entries(window.PITCHLAB_STATIC_TEAMS_BY_LEAGUE||{}).flatMap(([league,items])=>(items||[]).map(t=>({...t,leagues:[{name:canonicalLeagueName(league),leagueId:(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{})[canonicalLeagueName(league)]}]})));
    buildOfficialTeamAliasIndex(fallback);
  }
  function appendLocalDataScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=true;script.src=src;script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error(`Could not load ${src}`));};document.head.appendChild(script);});}
  async function ensureTeamCatalog(force=false){
    if(state.teamCatalogPromise)return state.teamCatalogPromise;
    if(state.teamCatalogScriptLoaded){if(force)syncOfficialTeamCatalog(true,true);return;}
    const task=(async()=>{try{
      if(!window.PITCHLAB_PESMASTER_TEAM_CATALOG)await appendLocalDataScript('data/pesmaster-team-catalog.js?v=2026-10-17-lazy-catalog-1');
      applyBundledTeamCatalog();render();if(force)syncOfficialTeamCatalog(true,true);
    }catch(error){state.teamCatalogScriptFailed=true;state.officialCatalogStatus={...state.officialCatalogStatus,status:'error',phase:'Could not load bundled team catalogue',error:String(error.message||error)};render();}})();
    state.teamCatalogPromise=task;try{await task;}finally{state.teamCatalogPromise=null;}
  }
  async function ensureCoachData(){
    if(state.coachDataPromise)return state.coachDataPromise;
    if(state.coachDataScriptLoaded)return;
    const task=(async()=>{try{
      if(!Array.isArray(window.PITCHLAB_PESMASTER_COACHES))await appendLocalDataScript('data/pesmaster-coaches-tactics.js?v=2026-10-17-team-tactic-links-2');
      state.coachDataScriptLoaded=Array.isArray(window.PITCHLAB_PESMASTER_COACHES);if(!state.coachDataScriptLoaded)throw new Error('Coach data was not found in the loaded file.');state.coachDataScriptFailed=false;render();
    }catch(error){state.coachDataScriptFailed=true;console.warn('PitchLab coach data load failed:',error);render();}})();
    state.coachDataPromise=task;try{await task;}finally{state.coachDataPromise=null;}
  }
  function teamCatalogStatusMarkup(){
    const x=state.officialCatalogStatus||{};const ar=state.lang==='ar';
    let line='';
    if(x.status==='running')line=`${ar?'جارٍ جلب فرق PESMASTER الرسمية':'Syncing official PESMASTER teams'} · ${Number(x.leaguesProcessed)||0}/${Number(x.leagueCount)||39} ${ar?'مسابقة':'competitions'} · ${Number(x.teamCount)||0} ${ar?'فريقًا':'team pages'}`;
    else if(x.status==='complete')line=`${ar?'اكتمل فهرس الفرق الرسمي':'Official team index verified'} · ${Number(x.leagueCount)||0}/39 ${ar?'مسابقة':'competitions'} · ${Number(x.teamCount)||0} ${ar?'فريقًا':'team pages'}`;
    else if(x.status==='partial')line=`${ar?'الفهرس غير مكتمل — تم الاحتفاظ بالبيانات السابقة':'Catalogue is incomplete — saved entries were preserved'} · ${Number(x.leagueCount)||0}/39 ${ar?'مسابقة':'competitions'} · ${Number(x.teamCount)||0} ${ar?'فريقًا':'team pages'}${x.error?` · ${esc(x.error)}`:''}`;
    else if(x.status==='error')line=`${ar?'تعذر تحديث المصدر؛ البيانات المحفوظة باقية':'Source refresh failed; saved data was retained'}${Number(x.teamCount)?` · ${Number(x.leagueCount)||0}/39 competitions · ${Number(x.teamCount)} team profiles`:''}${x.error?`: ${esc(x.error)}`:''}`;
    else if(x.status==='unavailable')line=ar?'شغّل الموقع من ملف START-PITCHLAB.bat لتفعيل المزامنة الرسمية.':'Start the site with START-PITCHLAB.bat to enable the official catalogue sync.';
    else if(!state.teamCatalogScriptLoaded)line=ar?'سوف يبدأ تحميل فهرس الفرق عند فتح صفحة الفرق أو الدوريات':'The team index loads when you open Teams or Leagues';
    else line=ar?'فهرس الفرق الرسمي جاهز':'Official team index is ready';
    const btn=(x.status==='error'||x.status==='partial'||x.status==='complete'||x.status==='unavailable')?`<button class="btn btn-sm" data-action="refresh-team-catalog">${ar?'تحديث فهرس الفرق':'Refresh official catalogue'}</button>`:'';
    return `<div class="section-card catalog-sync-note" id="team-catalog-status"><div><strong>${ar?'شعارات وأسماء الفرق الرسمية':'Official PESMASTER team badges'}</strong><p>${line}</p></div>${btn}</div>`;
  }
  function catalogTeamsAll(){
    const official=state.officialTeams||[];
    const staticRows=Object.entries(window.PITCHLAB_STATIC_TEAMS_BY_LEAGUE||{}).flatMap(([league,items])=>(items||[]).map(t=>({...t,leagues:[{name:canonicalLeagueName(league),leagueId:(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{})[canonicalLeagueName(league)]}]})));
    const result=[],byId=new Map(),byNameOnly=new Map();
    const add=(raw)=>{
      if(!raw||!(raw.name||raw.sourceName||raw.slug))return;
      const id=String(raw.teamId||'').trim();
      // Official IDs are authoritative. Never merge two different IDs just because their
      // display names/aliases look alike; this was incorrectly collapsing real teams.
      const nameKey=assetKey(raw.name||raw.sourceName||raw.slug);
      const key=id?'id:'+id:'name:'+nameKey;
      const index=id?byId:byNameOnly;
      const existing=index.get(key);
      if(existing){
        existing.aliases=Array.from(new Set([...(existing.aliases||[]),raw.name,raw.sourceName,raw.slug,...(raw.aliases||[])].filter(Boolean)));
        existing.leagues=Array.from(new Map([...(existing.leagues||[]),...(raw.leagues||[])].map(l=>[String(l.leagueId||'')+'|'+assetKey(l.name),l])).values());
        if(!existing.logoUrl&&raw.logoUrl)existing.logoUrl=raw.logoUrl;
        if(!(existing.logoCandidates||[]).length&&Array.isArray(raw.logoCandidates))existing.logoCandidates=raw.logoCandidates;
        if(!existing.sourceUrl&&raw.sourceUrl)existing.sourceUrl=raw.sourceUrl;
        return;
      }
      const row={...raw,teamId:id,aliases:Array.from(new Set([raw.name,raw.sourceName,raw.slug,...(raw.aliases||[])].filter(Boolean))),leagues:Array.isArray(raw.leagues)?raw.leagues.slice():[]};
      index.set(key,row);result.push(row);
    };
    official.forEach(add);
    // Verified static records supplement only missing IDs, e.g. if an official league page
    // was unreachable. They do not replace or merge a different official ID.
    staticRows.forEach(add);
    // When no official/static catalogue is available, keep player clubs visible but mark them
    // unassigned; never guess a league based on a fuzzy name or imported roster field.
    if(!result.length){for(const name of unique('club'))add({name,sourceName:name,aliases:[name],teamId:'',leagues:[],unassigned:true});}
    return result.sort((a,b)=>String(a.name).localeCompare(String(b.name))||String(a.teamId).localeCompare(String(b.teamId)));
  }
  function officialTeamCardName(team){return team?.name||team?.sourceName||team?.slug||'Unknown team';}

  let officialTeamCatalogApplied='';
  function updateTeamCatalogStatusElement(){const el=$('#team-catalog-status');if(!el)return;const holder=document.createElement('div');holder.innerHTML=teamCatalogStatusMarkup();const next=holder.firstElementChild;if(next)el.replaceWith(next);}
  function syncOfficialTeamCatalog(force=false,includeCached=false){
    if(state.officialCatalogPollTimer){clearTimeout(state.officialCatalogPollTimer);state.officialCatalogPollTimer=null;}
    const query=[];if(force)query.push('refresh=1');if(includeCached)query.push('includeCached=1');
    const url='/api/team-catalog'+(query.length?'?'+query.join('&'):'');
    fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Local catalog API returned ${r.status}`);return r.json();}).then(payload=>{
      state.officialCatalogStatus=payload||state.officialCatalogStatus;
      const teams=Array.isArray(payload?.teams)?payload.teams:[];
      if(teams.length){
        // Signature represents actual records/memberships, not the progress timestamp. During a
        // 39-page refresh the timestamp changes after every page; using it here caused repeated
        // full index rebuilds and renders while the catalogue was still being downloaded.
        const teamSignature=teams.map(t=>`${t.teamId}:${(t.leagues||[]).map(l=>String(l.leagueId)).sort().join(',')}`).join('|');
        const leagueSignature=(payload.leagues||[]).map(l=>`${l.leagueId}:${assetKey(l.name)}`).join('|');
        const sig=`${teams.length}:${leagueSignature}:${teamSignature}`;
        if(sig!==officialTeamCatalogApplied){officialTeamCatalogApplied=sig;buildOfficialTeamAliasIndex(teams);state.officialLeagues=Array.isArray(payload.leagues)?payload.leagues:[];
          if(['teams','leagues','team','league'].includes(state.route.page))render();
        }
      }
      updateTeamCatalogStatusElement();
      if(payload?.status==='running')state.officialCatalogPollTimer=setTimeout(()=>syncOfficialTeamCatalog(false),1700);
    }).catch(err=>{
      state.officialCatalogStatus={...state.officialCatalogStatus,status:'unavailable',phase:'Local catalogue service unavailable',error:''};
      // Direct-open fallback remains usable; the official sync endpoint is available when START-PITCHLAB.bat is used.
      updateTeamCatalogStatusElement();
    });
  }

  // PESMASTER team graphics: prefer verified source URL/name maps, then explicit imported IDs, then alternate image filename. Failed images automatically try the next source before falling back to initials.
  const TEAM_BADGES={
    'fc barcelona':'e_000108.png','barcelona':'e_000108.png',
    'fc bayern munchen':'e_000127.png','bayern munchen':'e_000127.png','bayern munich':'e_000127.png',
    'juventus':'e_000120.png','psg':'e_000114.png','paris saint-germain':'e_000114.png','paris saint germain':'e_000114.png',
    'manchester b':'e_000173.png','manchester city':'e_000173.png',
    'liverpool r':'e_000103.png','liverpool':'e_000103.png',
    'madrid chamartin b':'e_000109.png','real madrid':'e_000109.png',
    'tottenham wb':'e_000179.png','tottenham hotspur':'e_000179.png','tottenham':'e_000179.png',
    'manchester united':'e_000100_w.png',
    'madrid rosas rb':'e_000172.png','atletico madrid':'e_000172.png','atletico de madrid':'e_000172.png',
    'inter':'e_000119.png','lombardia na':'e_000119.png','chelsea':'e_000102.png','chelsea b':'e_000102.png','roma':'e_000125.png','as roma':'e_000125.png'
  };
  const TEAM_BADGES_BY_KEY=new Map(Object.entries(TEAM_BADGES).map(([k,v])=>[assetKey(k),v]));
  function badgeImageTag(className,raw,sources){const urls=uniqueAssetUrls(sources);if(!urls.length)return '';return `<img class="${className}" src="${esc(urls[0])}" data-fallbacks="${esc(JSON.stringify(urls.slice(1)))}" data-fallback-index="0" alt="${esc(raw)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.parentElement.classList.add('is-loaded')" onerror="const xs=JSON.parse(this.dataset.fallbacks||'[]');const i=Number(this.dataset.fallbackIndex||0);if(i<xs.length){this.dataset.fallbackIndex=String(i+1);this.src=xs[i]}else{this.parentElement.classList.add('is-fallback');this.parentElement.classList.remove('is-loaded');this.remove()}">`;}
  function clubLogoSources(raw){
    const key=assetKey(raw);const imported=findAssetByName(dataIndex.teamAssets,raw);const catalog=officialTeamForName(raw)||staticTeamEntry(raw);const sources=[];
    // Only use a URL that explicitly points to PESMASTER's PES 2021 team-logo directory.
    if(imported?.teamLogoUrl&&/^https?:\/\/www\.pesmaster\.com\/pes-2021\/graphics\/teamlogos\/e_\d{3,6}(?:_w)?\.png$/i.test(imported.teamLogoUrl))sources.push(imported.teamLogoUrl);
    if(catalog){
      const explicit=Array.isArray(catalog.logoCandidates)?catalog.logoCandidates:[];
      sources.push(...explicit);
      if(catalog.logoUrl)sources.push(catalog.logoUrl);
      // IDs are trusted only when they came from an official team-profile link/catalog entry.
      if(catalog.teamId)sources.push(...teamIdFiles(catalog.teamId));
      const profile=String(catalog.sourceUrl||'').match(/https?:\/\/www\.pesmaster\.com\/([^/]+)\/pes-2021\/team\/(\d+)\//i);
      if(profile)sources.push(...teamIdFiles(profile[2]));
    }
    const mapped=TEAM_BADGES_BY_KEY.get(key);if(mapped)sources.push(...teamFileCandidates(mapped));
    // Arbitrary generic teamId/clubId fields from community databases are intentionally ignored.
    const explicitId=String(imported?.pesmasterTeamId||'').trim();
    if(explicitId&&/^\d{1,6}$/.test(explicitId)&&/pesmaster\.com/i.test(String(imported?.sourceUrl||'')))sources.push(...teamIdFiles(explicitId));
    return uniqueAssetUrls(sources);
  }
  function clubLogo(name,size='md'){
    const raw=String(name||'Unassigned').trim()||'Unassigned';const urls=clubLogoSources(raw);
    return `<span class="club-logo-wrap club-logo-${size} ${urls.length?'':'is-fallback'}" role="img" aria-label="${esc(raw)} badge" title="${esc(raw)}"><span class="club-logo-fallback">${esc(initials(raw))}</span>${badgeImageTag('club-logo',`${raw} badge`,urls)}</span>`;
  }
  function clubLogoForEntry(entry,size='md'){
    if(!entry)return clubLogo('',size);
    const raw=String(entry.name||entry.sourceName||entry.slug||'Unknown team');
    const sources=[...(Array.isArray(entry.logoCandidates)?entry.logoCandidates:[])];
    if(entry.logoUrl)sources.push(entry.logoUrl);
    if(entry.teamId)sources.push(...teamIdFiles(entry.teamId));
    // A catalogue card must use the badge attached to this exact PESMASTER team ID,
    // not an alias lookup that could resolve to another club with a similar name.
    const urls=uniqueAssetUrls(sources);
    return `<span class="club-logo-wrap club-logo-${size} ${urls.length?'':'is-fallback'}" role="img" aria-label="${esc(raw)} badge" title="${esc(raw)}"><span class="club-logo-fallback">${esc(initials(raw))}</span>${badgeImageTag('club-logo',`${raw} badge`,urls)}</span>`;
  }
  const LEAGUE_BADGE_IDS_BY_KEY=new Map(Object.entries(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{}).map(([name,id])=>[assetKey(name),Number(id)]));
  function leagueIdFiles(id){if(id===null||id===undefined||id===''||!/^\d{1,4}$/.test(String(id)))return[];const code=String(id).padStart(4,'0');const files=id===12? [`emb_${code}_w.png`,`emb_${code}.png`]:[`emb_${code}.png`,`emb_${code}_w.png`];return files.map(f=>`https://www.pesmaster.com/pes-2021/graphics/leaguelogos/${f}`);}
  function leagueLogoSources(raw){const display=canonicalLeagueName(raw);const key=assetKey(display);const imported=findAssetByName(dataIndex.leagueAssets,display);const scraped=(state.officialLeagues||[]).find(l=>canonicalLeagueName(l.name)===display);const officialId=LEAGUE_BADGE_IDS_BY_KEY.get(key)??(scraped?.leagueId!==undefined?Number(scraped.leagueId):undefined);const sources=[];
    if(scraped?.logoUrl&&/^https?:\/\/www\.pesmaster\.com\/pes-2021\/graphics\/leaguelogos\/emb_\d{4}(?:_w)?\.png$/i.test(scraped.logoUrl))sources.push(scraped.logoUrl);
    if(officialId!==undefined)sources.push(...leagueIdFiles(officialId));
    if(imported?.leagueLogoUrl&&/pesmaster\.com\/pes-2021\/graphics\/leaguelogos\//i.test(imported.leagueLogoUrl))sources.push(imported.leagueLogoUrl);
    if(imported?.leagueLogoUrl)sources.push(imported.leagueLogoUrl);
    const id=imported?.leagueLogoId||imported?.pesmasterLeagueId||imported?.leagueId;
    if(id!==undefined&&id!=='')sources.push(...leagueIdFiles(id));
    const sourceUrl=String(imported?.sourceUrl||'');const m=sourceUrl.match(/\/league\/(\d+)\/?(?:[?#].*)?$/i);if(m)sources.push(...leagueIdFiles(m[1]));
    return uniqueAssetUrls(sources);
  }
  function leagueLogo(name,size='md'){
    const raw=canonicalLeagueName(String(name||'Unknown competition').trim()||'Unknown competition');const urls=leagueLogoSources(raw);const fallback=assetKey(raw)==='free agent'?'FA':initials(raw);
    return `<span class="league-logo-wrap league-logo-${size} ${urls.length?'':'is-fallback'}" role="img" aria-label="${esc(raw)} league emblem" title="${esc(raw)}"><span class="league-logo-fallback">${esc(fallback)}</span>${badgeImageTag('league-logo',`${raw} league emblem`,urls)}</span>`;
  }
  function leagueSourceUrl(name){const raw=canonicalLeagueName(name);const map=window.PITCHLAB_LEAGUE_PESMASTER_URLS||{};if(map[raw])return map[raw];const found=(state.officialLeagues||[]).find(l=>canonicalLeagueName(l.name)===raw);if(found?.url)return found.url;if(raw==='Other European Teams')return map['Other European Leagues']||'';return '';}
  const PORTRAIT_IDS_BY_NAME={lionelmessi:'18881879',lmessi:'18881879',robertlewandowski:'201366594',rlewandowski:'201366594',cristianoronaldo:'198185386',neymar:'40352',neymarjunior:'40352',neymardasilvasantosjunior:'40352',diegoarmandomaradona:'2453',dmaradona:'2453',johancruyff:'2397',johancruijff:'2397',jcruijff:'2397'};
  function portraitUrl(p){
    const safeUrl=String(p.portraitUrl||'');
    const pesmasterMobile=safeUrl.match(/^(https:\/\/www\.pesmaster\.com)\/pes-2021-mobile\/graphics\/players\/(player_\d+\.png)$/i);
    if(pesmasterMobile) return `${pesmasterMobile[1]}/pes-2021/graphics/players/${pesmasterMobile[2]}`;
    if(/^https:\/\/www\.pesmaster\.com\/pes-2021\/graphics\/players\/player_\d+\.png$/i.test(safeUrl)) return safeUrl;
    if(/^https:\/\/(?:raw\.githubusercontent\.com|images\.pesdb\.net|www\.pesmaster\.com)\//i.test(safeUrl)) return safeUrl;
    let id=(p.dataStatus==='AUTHENTIC'||String(p.portraitSource||'').toLowerCase()==='pesmaster'||p.pesmasterPlayerId)?(String(p.portraitId||p.pesmasterPlayerId||'').match(/^\d+$/)?.[0]||''):'';
    if(!id&&/pesmaster\.com/i.test(String(p.sourceUrl||''))){const match=String(p.sourceUrl).match(/\/player\/(\d+)\/?(?:[?#].*)?$/i);if(match)id=match[1];}
    if(!id){const slug=String(p.name||p.displayName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');id=PORTRAIT_IDS_BY_NAME[slug]||'';}
    return id?`https://www.pesmaster.com/pes-2021/graphics/players/player_${id}.png`:'';
  }
  function tone(p){const n=parseInt(String(p.id).replace(/\D/g,''),10)||0;return 'avatar-tone-'+(n%5);}
   function avatar(p,large=false,extraClass=''){const src=portraitUrl(p),rawId=String(p.portraitId||p.pesmasterPlayerId||'').match(/^\d+$/)?.[0]||'',fallback=String(p.portraitFallbackUrl||(rawId?`https://www.pesmaster.com/pes-2021/graphics/players/player_${rawId}.png`:''));const safeFallback=/^https:\/\/www\.pesmaster\.com\/pes-2021(?:-mobile)?\/graphics\/players\/player_\d+\.png$/i.test(fallback)?fallback:'';return `<div class="player-avatar ${large?'large':''} ${tone(p)} ${extraClass} ${src?'has-portrait':''}" aria-hidden="true"><span class="player-avatar-initials">${esc(initials(p.displayName||p.name))}</span>${src?`<img class="player-portrait" src="${src}"${safeFallback?` data-fallback="${esc(safeFallback)}"`:''} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="if(this.dataset.fallback&amp;&amp;this.src!==this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback}else{this.remove();this.parentElement.classList.remove('has-portrait')}">`:''}</div>`;}
  function flag(n){const name=String(n||'');const item=dataIndex.flagAssets.get(name);return item?`<span class="flag flag-image"><img src="${esc(item)}" alt="${esc(name)} flag" loading="lazy" decoding="async" onerror="this.parentElement.textContent='🌐'"></span>`:`<span class="flag">${FLAGS[name]||'🌐'}</span>`;}
  function byId(id){return dataIndex.playerById.get(String(id));}
  function routeNow(){let raw=location.hash.replace(/^#\/?/,'');const bits=raw?raw.split('/').map(s=>decodeURIComponent(s)):[];return {page:bits[0]||'home',params:bits.slice(1)};}
  function go(path){const next='#/'+String(path||'').replace(/^\//,'');state.pickerOpen=false;state.activeSlot=null;if(location.hash===next){render();return;}location.hash=next;render();}
  const PLAYER_CATALOG_ROUTES=new Set(['search','compare','squad','teams','leagues','team','league','player']);
  const TEAM_CATALOG_ROUTES=new Set(['teams','leagues','team','league','master-league']);
  const COACH_DATA_ROUTES=new Set(['coaches','coach','tactics','tactic','team']);
  function notify(message){const node=$('#toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>node.classList.remove('show'),2600);}
  function unique(key){return dataIndex.unique[key]||[...new Set(state.players.map(p=>p[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));}
  function allAttrs(p){return ALL_ATTRS.map(([key,label])=>({key,label,value:p.attributes?.[key] }));}
  function navLabel(page,label,icon){const active=state.route.page===page||(page==='teams'&&state.route.page==='team')||(page==='leagues'&&state.route.page==='league')||(page==='coaches'&&state.route.page==='coach')||(page==='tactics'&&state.route.page==='tactic');return `<button class="navlink ${active?'active':''}" data-route="${page==='home'?'':page}"><span class="navicon">${icon}</span>${tr(label)}</button>`;}
  function header(){return `<div class="topline"><div class="wrap"><span><span class="online-dot"></span>PES 2021 database tools · community project</span><div class="top-right"><span>Build your shortlist, compare &amp; scout</span><button class="header-tool" data-action="language">${state.lang==='ar'?'English':'عربي'}</button></div></div></div>
    <header class="masthead"><div class="wrap masthead-main"><button class="brand" data-route="" aria-label="PitchLab 21 home" style="background:transparent;border:0;color:inherit;padding:0;text-align:left"><span class="brand-mark"><span>P21</span></span><span><span class="brand-name">PITCHLAB <b>21</b></span><span class="brand-sub">PES 2021 DATABASE</span></span></button><form class="global-search" id="global-search-form"><input id="global-search" type="search" placeholder="${tr('Search players, clubs or positions…')}" value="${esc(state.route.page==='search'?state.filters.q:'')}" aria-label="Global player search"><button type="submit">⌕ &nbsp;${tr('Search')}</button></form><div class="head-actions"><button class="header-tool" data-route="compare">⇄ ${tr('Compare')}</button><button class="header-tool" data-route="squad">♙ ${tr('Build a squad')}</button></div></div><div class="navrow"><nav class="wrap mainnav">${navLabel('home','Home','⌂')}${navLabel('master-league','Master League','♛')}${navLabel('search','Players','♙')}${navLabel('search','Advanced Search','⌕')}${navLabel('compare','Compare','⇄')}${navLabel('teams','Teams','▦')}${navLabel('leagues','Leagues','◎')}${navLabel('coaches','Coaches','♟')}${navLabel('tactics','Team Tactics','⌘')}${navLabel('squad','Squad Builder','▥')}${navLabel('import','Import Data','⇧')}<span class="data-chip">${state.players.some(p=>p.pesmasterPlayerId)?'PESMASTER PLAYERS':(state.imported?'CUSTOM DATASET':'PES 2021 SAMPLE')}</span></nav></div></header>`;}
  function footer(){return `<footer class="site-footer"><div class="wrap footer-inner"><div><div class="footer-brand">PITCHLAB <span style="color:#a98aff">21</span></div><p>A PES 2021 fan database toolkit. The player search uses the PESMASTER PES 2021 Advanced Search catalogue. Full player profiles open inside PitchLab. See each profile for its source.</p></div><div class="footer-links"><button data-route="search">Player database</button><button data-route="compare">Compare</button><button data-route="squad">Squad builder</button><button data-route="import">Data import</button></div></div></footer>`;}
  function demoBanner(){
    let title=state.players.some(p=>p.pesmasterPlayerId)?'PESMASTER player catalogue active':(state.players.length>=1000?'Full player database active':(state.imported?'Custom dataset active':'Real PES 2021 sample active'));
    let note=state.players.length>=1000?`${state.players.length.toLocaleString()} player records are loaded and saved in this browser.`:(state.imported?`Current local dataset: ${state.players.length.toLocaleString()} records.`:`Showing ${state.players.length} sample players. The full catalogue loads only when you open a player-data section.`);
    let action=state.fullDatabaseLoading?`<button class="btn btn-sm" disabled>Loading player catalogue…</button>`:(state.fullDatabaseStatus==='failed'?`<button class="btn btn-sm btn-primary" data-action="load-pesmaster-catalog">Retry player catalogue</button>`:(state.fullDatabaseStatus==='idle'&&state.players.length<1000?`<button class="btn btn-sm btn-primary" data-route="search">Open player database</button>`:`<button class="btn btn-sm" data-route="import">${state.players.length>=1000?'Manage dataset':'Database details'}</button>`));
    if(state.fullDatabaseStatus==='loading') note='Loading the PESMASTER player catalogue because a player-data section was opened.';
    if(state.fullDatabaseStatus==='loaded') note=state.players.some(p=>p.pesmasterPlayerId)?`Loaded ${state.players.length.toLocaleString()} PESMASTER PES 2021 Advanced Search records; player portraits and full profiles are opened inside this site.`:`Loaded ${state.players.length.toLocaleString()} player records from a community patch; this does not establish full PESMASTER coverage, team crests or portraits. Your original profiles and custom tactics remain preserved.`;
    if(state.fullDatabaseStatus==='failed') note=`The player catalogue could not be loaded. ${state.players.length.toLocaleString()} current records remain available. ${state.fullDatabaseError?state.fullDatabaseError:''}`;
    if(state.fullDatabaseStatus==='fallback') note='The first source failed; trying the OpenML PES 2021 base database. Current records remain preserved.';
    return `<div class="demo-banner"><div><strong>ⓘ ${title}</strong> — ${note}${state.fullDatabaseStatus==='loading'||state.fullDatabaseStatus==='failed'?` <a href="${COMMUNITY_SOURCE_URL}" target="_blank" rel="noopener noreferrer" style="color:var(--purple)">Data source ↗</a>`:''}</div>${action}</div>`;
  }
  function progressPanel(){
    const p=state.downloadProgress;
    if(p.phase==='idle')return '';
    const pct=Math.max(0,Math.min(100,Math.round(p.percent||0)));
    const ar=state.lang==='ar';
    const label=p.phase==='done'?(ar?'اكتمل استيراد البيانات':'Database imported'):
      p.phase==='error'?(ar?'تعذّر التحميل':'Download failed'):
      p.phase==='fallback'?(ar?'المصدر الأول فشل؛ جارٍ تجربة مصدر بديل':'First source failed; trying backup'):
      (ar?'تحميل PES 2021 Player Database':'Downloading PES 2021 Player Database');
    const fmtBytes=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';
    const measured=p.total>0?`${fmtBytes(p.bytes)} / ${fmtBytes(p.total)}`:p.bytes?`${fmtBytes(p.bytes)} ${ar?'تم استلامها، الحجم الإجمالي غير معروف':'received, total size unknown'}`:'';
    const steps=[ar?'تنزيل سجلات اللاعبين':'Download players',ar?'تحليل اللاعبين والفرق والدوريات':'Process players, teams & leagues',ar?'حفظ قاعدة البيانات':'Save database',ar?'الصور والشعارات والانتقالات':'Portraits, badges & transfers'];
    return `<section class="db-download" aria-label="PES 2021 Player Database loading"><div class="db-download-top"><div><strong>⚽ ${label}</strong><small>${esc(p.detail||'')} ${measured?'· '+measured:''}</small></div><b class="db-percent">${p.phase==='error'?'!':(p.total||p.phase==='done'||p.percent>=80?pct+'%':'…')}</b></div><div class="db-track" role="progressbar" aria-label="Database download progress" aria-valuemin="0" aria-valuemax="100" ${p.total||p.phase==='done'?`aria-valuenow="${pct}"`:'aria-valuetext="Downloading: total file size unavailable"'}><span class="db-fill ${!p.total&&p.phase==='download'?'db-indeterminate':''}" style="width:${pct}%"></span></div><div class="db-steps">${steps.map((x,i)=>`<span class="${p.phase==='done'&&i<3?'db-step-done':p.phase==='download'&&i===0?'db-step-current':p.phase==='parse'&&i===1?'db-step-current':p.phase==='save'&&i===2?'db-step-current':''}">${x}${i===3?' · '+(ar?'تُعرض فقط إن كانت متوفرة بالمصدر':'only if provided by source'):''}</span>`).join('')}</div>${p.phase==='error'?`<button class="btn btn-sm btn-primary" data-action="load-community-db">${ar?'إعادة المحاولة':'Retry'}</button>`:''}</section>`;
  }
  function setProgress(phase,percent,detail,bytes=0,total=0){
    clearTimeout(state.progressHideTimer);
    state.downloadProgress={phase,percent,detail,bytes,total};
    const old=document.querySelector('.db-download');
    const fresh=progressPanel();
    if(old)old.outerHTML=fresh;
    else if(fresh){const banner=document.querySelector('.demo-banner');if(banner)banner.insertAdjacentHTML('beforebegin',fresh);}
    if(phase==='done')state.progressHideTimer=setTimeout(()=>{if(state.downloadProgress.phase==='done'){state.downloadProgress={phase:'idle',percent:0,detail:'',bytes:0,total:0};document.querySelector('.db-download')?.remove();}},1800);
  }
  async function fetchWithProgress(url){
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),90000);
    try{
      const response=await fetch(url,{mode:'cors',cache:'force-cache',signal:ctrl.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const encoding=(response.headers.get('content-encoding')||'').toLowerCase();let total=encoding&&encoding!=='identity'?0:(Number(response.headers.get('content-length'))||0);
      if(!response.body||!response.body.getReader){const text=await response.text();setProgress('parse',82,'Download complete · preparing records');return text;}
      const reader=response.body.getReader(),decoder=new TextDecoder();const chunks=[];let bytes=0,last=-1;
      while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(total&&bytes>total)total=0;chunks.push(decoder.decode(value,{stream:true}));const pct=total?Math.min(79,Math.round(bytes/total*79)):0;if(pct!==last||(!total&&bytes-last>1000000)){setProgress('download',pct,total?'Receiving PES 2021 records':'Receiving data; file size not reported',bytes,total);last=total?pct:bytes;}}
      chunks.push(decoder.decode());setProgress('parse',82,'Download complete · preparing records',bytes,total);return chunks.join('');
    }catch(err){if(err.name==='AbortError')throw new Error('The download timed out after 90 seconds. Check the connection and retry.');throw err;}
    finally{clearTimeout(timer);}
  }
  function shell(content){document.documentElement.lang=state.lang;document.documentElement.dir=state.lang==='ar'?'rtl':'ltr';return `${header()}<main><div class="wrap">${progressPanel()}${demoBanner()}${content}</div></main>${footer()}${pickerModal()}`;}
  function heading(title,desc,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${state.route.page==='home'?'PITCHLAB 21 / PES 2021':'PES 2021 DATABASE'}</div><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`;}
  function toolTile(glyph,title,desc,route){return `<button class="tool-tile" data-route="${route}"><span class="tool-glyph">${glyph}</span><span><strong>${tr(title)}</strong><small>${desc}</small></span></button>`;}
  function renderHome(){
    const top=dataIndex.topPlayers;
    const young=dataIndex.youngPlayers;
    const clubs=unique('club').length, leagues=unique('league').length;
    return `<section class="hero"><div class="hero-kicker">${tr('PES 2021 DATABASE')} · SCOUTING TOOLS</div><h1>${tr('Find your next signing')}<br>Built for the beautiful game.</h1><p>Search player attributes, study profiles, compare real database values, and assemble your ideal PES 2021 XI from one connected dataset.</p><form id="hero-search-form" class="hero-search"><input id="hero-search" type="search" placeholder="${tr('Search players, clubs or positions…')}" autocomplete="off"><button type="submit">⌕ &nbsp;${tr('Open database')}</button></form><div class="hero-links"><button data-route="search">↗ Advanced player filters</button><button data-route="compare">↗ Player comparison</button><button data-route="squad">↗ Squad builder</button><button data-route="import">↗ Import your data</button></div></section>
      <div class="metrics-grid"><div class="metric-card"><div class="metric-icon">♙</div><div><strong>${state.players.length.toLocaleString()}</strong><span>Players in current dataset</span></div></div><div class="metric-card"><div class="metric-icon">▦</div><div><strong>${clubs}</strong><span>Clubs represented</span></div></div><div class="metric-card"><div class="metric-icon">◎</div><div><strong>${leagues}</strong><span>Leagues represented</span></div></div><div class="metric-card"><div class="metric-icon">♟</div><div><strong>${coaches().length}</strong><span>Coach profiles &amp; team tactics</span></div></div></div>
      <div class="home-grid"><div><div class="section-card"><div class="section-head"><div><h2>Database tools</h2><p>Everything for player research, comparison and team building.</p></div><span class="pill pill-purple">TOOLS</span></div><div class="section-body"><div class="tool-grid">${toolTile('⌕','Advanced Search','Filter by position, ratings, attributes and skills.','search')}${toolTile('⇄','Player Comparison','Compare up to four players attribute by attribute.','compare')}${toolTile('▥','Squad Builder','Arrange a formation and save your best XI.','squad')}${toolTile('▦','Teams','Browse squads and filter players by position.','teams')}${toolTile('◎','Leagues','Explore the clubs in each competition.','leagues')}${toolTile('♟','Coaches','Browse in-game managers and their tactical settings.','coaches')}${toolTile('⌘','Team Tactics','Inspect formations, pressing and build-up profiles.','tactics')}${toolTile('♛','Master League','Choose a team, play a season and simulate every matchday.','master-league')}${toolTile('⇧','Import Data','Load your own CSV or JSON player dataset.','import')}</div></div></div>
      <div class="section-card" style="margin-top:16px"><div class="section-head"><div><h2>Popular clubs</h2><p>Browse the teams in the active dataset.</p></div><button class="btn btn-sm" data-route="teams">View all →</button></div><div class="section-body"><div class="entity-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${unique('club').slice(0,4).map(c=>{let n=dataIndex.clubStats.get(c)?.count||0;return `<button class="entity-card" data-team="${esc(c)}">${clubLogo(c,'lg')}<h3>${esc(c)}</h3><p>${esc(unique('league').find(l=>state.players.some(p=>p.club===c&&p.league===l))||'—')}</p><span class="entity-meta">${n} players ↗</span></button>`}).join('')}</div></div></div><div class="section-card" style="margin-top:16px"><div class="section-head"><div><h2>Popular leagues</h2><p>Jump into a competition in the current dataset.</p></div><button class="btn btn-sm" data-route="leagues">View all →</button></div><div class="top-player-list">${unique('league').slice(0,4).map(l=>{const ps=dataIndex.playersByLeague.get(l)||[];const meta=dataIndex.leagueStats.get(l)||{clubs:0,players:0};return `<button class="top-player" data-league="${esc(l)}">${leagueLogo(l,'xs')}<div class="top-player-info"><strong>${esc(l)}</strong><small>${meta.clubs} clubs · ${meta.players} players</small></div><span class="navicon">↗</span></button>`}).join('')}</div></div></div>
      <div><div class="section-card"><div class="section-head"><div><h2>${tr('Featured players')}</h2><p>${tr('Top-rated players from PESMASTER PES 2021')}</p></div><button class="btn btn-sm" data-route="search">View all →</button></div><div class="top-player-list">${top.map(p=>`<div class="top-player" data-player="${esc(p.id)}">${avatar(p)}<div class="top-player-info"><strong>${esc(p.displayName)}</strong><small>${esc(p.position)} · ${clubLogo(p.club,'xs')} ${esc(p.club)}</small></div><span class="rating-badge">${fmt(p.overall)}</span></div>`).join('')}</div></div>
      <div class="section-card" style="margin-top:16px"><div class="section-head"><h2>Quick position finder</h2><span class="pill pill-gray">13 positions</span></div><div class="section-body"><div class="position-grid">${POSITIONS.map(pos=>`<button class="position-check" data-quick-position="${pos}" style="border:0;background:transparent;padding:0"><span>${pos}</span></button>`).join('')}</div><p class="tiny muted" style="margin:11px 0 0">Choose a position to open matching player results.</p></div></div><div class="section-card" style="margin-top:16px"><div class="section-head"><div><h2>Young talents</h2><p>High-potential players in the PESMASTER catalogue.</p></div><button class="btn btn-sm" data-route="search">Scout →</button></div><div class="top-player-list">${young.map(p=>`<button class="top-player" data-player="${esc(p.id)}">${avatar(p)}<div class="top-player-info"><strong>${esc(p.displayName)}</strong><small>Age ${fmt(p.age)} · ${esc(p.position)}</small></div><span class="rating-badge" style="background:#e4f7ef;color:#168661">${fmt(p.potential)}</span></button>`).join('')||'<div class="tiny muted" style="padding:12px 14px;line-height:1.6">Potential ratings are not supplied for these sourced base profiles. Import a dataset with documented potential values to populate this section.</div>'}</div></div></div></div>`;
  }
  function filterValue(key){return state.filters[key]??'';}
  function field(label,key,type='text',placeholder='',extra=''){return `<div class="field"><label>${label}</label><input type="${type}" data-filter="${key}" value="${esc(filterValue(key))}" placeholder="${esc(placeholder)}" ${extra}></div>`;}
  function selectField(label,key,values,placeholder='Any'){return `<div class="field"><label>${label}</label><select data-filter="${key}"><option value="">${placeholder}</option>${values.map(item=>{const v=typeof item==='object'?item.key:item;const labelText=typeof item==='object'?item.label:item;return `<option value="${esc(v)}" ${String(filterValue(key))===String(v)?'selected':''}>${esc(labelText)}</option>`}).join('')}</select></div>`;}
  function rangeFields(label,minKey,maxKey,minPlaceholder='Min',maxPlaceholder='Max'){return `<div class="field"><label>${label}</label><div class="range-pair"><input data-filter="${minKey}" type="number" min="0" value="${esc(filterValue(minKey))}" placeholder="${minPlaceholder}" aria-label="${label} minimum"><input data-filter="${maxKey}" type="number" min="0" value="${esc(filterValue(maxKey))}" placeholder="${maxPlaceholder}" aria-label="${label} maximum"></div></div>`;}
  function renderSearch(){
    const selectedSkills=state.filters.skills||[];
    return `${heading(tr('Player Database'),tr('Search and filter the PES 2021 player pool.'),`<button class="btn" data-route="import">⇧ Import Data</button><button class="btn btn-primary" data-action="export-csv">↓ ${tr('Download CSV')}</button>`)}
      <div class="search-layout"><aside class="section-card filter-card"><div class="section-head"><div><h2>⌕ ${tr('Filters')}</h2><p>Combine filters to narrow the player list.</p></div><button class="btn btn-sm btn-ghost" data-action="clear-filters">Clear all</button></div><div class="filter-content">
      <div class="filter-section"><div class="filter-title">Player</div>${field('Player name','q','search','Name, alias…')}</div>
      <div class="filter-section"><div class="filter-title">Position</div><div class="position-grid">${POSITIONS.map(pos=>`<label class="position-check"><input type="checkbox" data-position="${pos}" ${(state.filters.positions||[]).includes(pos)?'checked':''}><span>${pos}</span></label>`).join('')}</div></div>
      <div class="filter-section"><div class="filter-title">Rating &amp; age</div><div class="field-grid">${rangeFields('Overall rating','minOverall','maxOverall')}${rangeFields('Potential rating','minPotential','maxPotential')}${rangeFields('Age','minAge','maxAge')}${rangeFields('Height (cm)','minHeight','maxHeight')}</div></div>
      <div class="filter-section"><div class="filter-title">Club &amp; competition</div><div class="field-grid">${selectField('Club','club',unique('club'))}${selectField('League','league',unique('league'))}${selectField('Nationality','nationality',unique('nationality'))}${selectField('Stronger foot','foot',['Right','Left','Both'])}</div></div>
      <div class="filter-section"><div class="filter-title">Player identity</div><div class="field-grid">${selectField('Playing style','style',unique('playingStyle'))}${selectField('Has skill','skill',uniqueSkills())}</div></div>
      <div class="filter-section"><div class="filter-title">Attribute minimum</div><div class="field-grid">${selectField('Attribute','attribute',allAttributeKeys())}${field('Minimum value','minAttribute','number','e.g. 80','min="0" max="99"')}</div><div class="tiny muted" style="margin-top:8px">Filters the selected attribute using the minimum value.</div></div>
      <div class="filter-section"><div class="filter-title">Player skills <span class="pill pill-gray">Multi-select</span></div><div class="skill-checklist">${COMMON_SKILLS.map(skill=>`<label class="check-line"><input type="checkbox" data-skill="${esc(skill)}" ${selectedSkills.includes(skill)?'checked':''}>${esc(skill)}</label>`).join('')}</div></div>
      </div><div class="filter-footer"><button class="btn btn-primary" data-action="apply-filters">${tr('Apply Filters')}</button><button class="btn" data-action="clear-filters">${tr('Reset')}</button></div></aside>
      <section class="section-card search-main" id="results-area">${renderResults()}</section></div>`;
  }
  function uniqueSkills(){return dataIndex.uniqueSkills;}
  function allAttributeKeys(){return ALL_ATTR_KEYS;}
  function filteredPlayers(){
    const f=state.filters;const query=String(f.q||'').trim().toLowerCase();
    const sourcePlayers=f.club?(dataIndex.playersByClub.get(f.club)||[]):(f.league?(dataIndex.playersByLeague.get(f.league)||[]):state.players);
    let arr=sourcePlayers.filter(p=>{
      const text=[p.name,p.displayName,p.club,p.league,p.nationality,p.position,...(p.secondaryPositions||[])].join(' ').toLowerCase();
      if(query&&!text.includes(query))return false;
      if(f.nationality&&p.nationality!==f.nationality)return false;if(f.club&&p.club!==f.club)return false;if(f.league&&p.league!==f.league)return false;
      if((f.positions||[]).length&&!f.positions.some(pos=>p.position===pos||(p.secondaryPositions||[]).includes(pos)))return false;
      const ranges=[['minOverall','overall',true],['maxOverall','overall',false],['minPotential','potential',true],['maxPotential','potential',false],['minAge','age',true],['maxAge','age',false],['minHeight','height',true],['maxHeight','height',false]];
      for(const [fk,pk,isMin] of ranges){if(f[fk]!==''&&f[fk]!==undefined){const val=p[pk],target=Number(f[fk]);if(val===null||val===undefined||(isMin?val<target:val>target))return false;}}
      if(f.foot&&p.foot!==f.foot)return false;if(f.style&&p.playingStyle!==f.style)return false;
      if(f.skill&&!(p.skills||[]).includes(f.skill))return false;
      if((f.skills||[]).length&&!(f.skills||[]).every(s=>(p.skills||[]).includes(s)))return false;
      if(f.attribute&&f.minAttribute!==''&&f.minAttribute!==undefined){const val=p.attributes?.[f.attribute];if(val===null||val===undefined||val<Number(f.minAttribute))return false;}
      return true;
    });
    const key=state.sortKey;arr.sort((a,b)=>{let av=key==='name'?a.displayName:a[key],bv=key==='name'?b.displayName:b[key];if(key.startsWith('attr:')){const attr=key.slice(5);av=a.attributes?.[attr];bv=b.attributes?.[attr];}if(av===null||av===undefined)av=state.sortDir==='asc'?Infinity:-Infinity;if(bv===null||bv===undefined)bv=state.sortDir==='asc'?Infinity:-Infinity;if(typeof av==='string'||typeof bv==='string'){return (String(av).localeCompare(String(bv)))*(state.sortDir==='asc'?1:-1);}return (av-bv)*(state.sortDir==='asc'?1:-1);});
    return arr;
  }
  function overallClass(v){return Number(v)>=85?' high':'';}
  function renderResults(){
    const filtered=filteredPlayers();const total=filtered.length;const pages=Math.max(1,Math.ceil(total/state.pageSize));state.page=Math.min(Math.max(1,state.page),pages);const start=(state.page-1)*state.pageSize;const list=filtered.slice(start,start+state.pageSize);
    const sortFields=[['overall','Overall'],['potential','Potential'],['age','Age'],['height','Height'],['name','Name'],['speed','Speed'],['dribbling','Dribbling']];
    const compareDisabled=state.selectedIds.size<2;
    const toolbar=`<div class="results-toolbar"><div class="result-summary"><strong id="result-count">${total.toLocaleString()} ${tr('players found')}</strong><span>Showing ${total?start+1:0}–${Math.min(start+state.pageSize,total)} of ${total} ${state.imported?'custom records':'sourced PES 2021 records'}</span></div><div class="toolbar-actions"><div class="view-switch"><button data-action="view-table" class="${state.view==='table'?'active':''}">${tr('Table View')}</button><button data-action="view-card" class="${state.view==='card'?'active':''}">${tr('Card View')}</button></div><button class="btn btn-sm" data-action="compare-selected" ${compareDisabled?'disabled':''}>⇄ ${tr('Compare Selected')} (${state.selectedIds.size})</button><button class="btn btn-sm btn-primary" data-action="export-csv">↓ CSV</button></div></div>`;
    let body='';
    if(!total){body=`<div class="empty-state"><div class="empty-icon">⌕</div><strong>${tr('No players found')}</strong><div>Try removing a filter or widening your rating range.</div><button class="btn btn-sm" style="margin-top:14px" data-action="clear-filters">Clear all filters</button></div>`;}
    else if(state.view==='card'){
      body=`<div class="cards-grid">${list.map(p=>`<article class="player-card"><div class="player-card-top">${avatar(p)}<div class="player-card-info"><button class="table-link" data-player="${esc(p.id)}"><strong>${esc(p.displayName)}</strong></button><small>${clubLogo(p.club,'xs')} <span>${esc(p.club)} · ${esc(p.position)}</span></small></div><span class="overall${overallClass(p.overall)}">${fmt(p.overall)}</span></div><div class="player-card-stats"><div class="player-stat"><strong>${fmt(p.potential)}</strong><span>POTENTIAL</span></div><div class="player-stat"><strong>${fmt(p.age)}</strong><span>AGE</span></div><div class="player-stat"><strong>${fmt(p.attributes?.speed)}</strong><span>SPEED</span></div></div><div class="player-card-bottom"><label><input class="player-check" type="checkbox" data-select-player="${esc(p.id)}" ${state.selectedIds.has(String(p.id))?'checked':''}> Select to compare</label><button class="btn btn-sm" data-player="${esc(p.id)}">Profile ↗</button></div></article>`).join('')}</div>`;
    }else{
      const cols=[['overall','Overall'],['potential','Potential'],['age','Age'],['height','Height'],['attr:lowPass','Low Pass'],['attr:finishing','Finishing'],['attr:physicalContact','Physical'],['attr:defensiveAwareness','Def. Aware.'],['attr:speed','Speed'],['attr:dribbling','Dribbling']];
      const sortable=(key,label)=>`<th data-sort="${key}" title="Sort by ${label}">${label}${state.sortKey===key?(state.sortDir==='asc'?' ↑':' ↓'):''}</th>`;
      body=`<div class="table-scroll"><table class="player-table"><thead><tr><th style="width:29px"><input type="checkbox" class="player-check" data-action="select-page" aria-label="Select this page"></th><th data-sort="name">Player ${state.sortKey==='name'?(state.sortDir==='asc'?'↑':'↓'):''}</th><th>Club</th><th>Nationality</th><th>Pos.</th>${cols.map(c=>sortable(c[0],c[1])).join('')}</tr></thead><tbody>${list.map(p=>`<tr><td><input type="checkbox" class="player-check" data-select-player="${esc(p.id)}" ${state.selectedIds.has(String(p.id))?'checked':''} aria-label="Select ${esc(p.displayName)}"></td><td><div class="table-player">${avatar(p)}<span><button class="table-link" data-player="${esc(p.id)}">${esc(p.displayName)}</button><small>${esc(p.playingStyle||'—')}</small></span></div></td><td class="team-cell" title="${esc(p.club)}"><span class="team-cell-inner">${clubLogo(p.club,'xs')}<span>${esc(p.club)}</span></span></td><td>${flag(p.nationality)}${esc(p.nationality)}</td><td><span class="position-tag">${esc(p.position)}</span></td><td><span class="overall${overallClass(p.overall)}">${fmt(p.overall)}</span></td><td class="potential-cell">${fmt(p.potential)}</td><td>${fmt(p.age)}</td><td>${fmt(p.height)}</td><td>${fmt(p.attributes?.lowPass)}</td><td>${fmt(p.attributes?.finishing)}</td><td>${fmt(p.attributes?.physicalContact)}</td><td>${fmt(p.attributes?.defensiveAwareness)}</td><td>${fmt(p.attributes?.speed)}</td><td>${fmt(p.attributes?.dribbling)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    const fromPage=Math.max(1,state.page-2),toPage=Math.min(pages,fromPage+4);
    return `${toolbar}<div id="results-content">${body}</div><div class="table-bottom"><div class="tiny muted">Page ${state.page} of ${pages} · ${state.pageSize} per page</div><div style="display:flex;align-items:center;gap:8px"><label class="tiny muted" for="page-size">Rows</label><select id="page-size" class="control" data-pagesize style="width:75px;height:29px;padding:4px"><option ${state.pageSize===10?'selected':''}>10</option><option ${state.pageSize===15?'selected':''}>15</option><option ${state.pageSize===25?'selected':''}>25</option><option ${state.pageSize===50?'selected':''}>50</option></select><div class="pagination"><button class="page-btn" data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="Previous page">‹</button>${Array.from({length:toPage-fromPage+1},(_,i)=>fromPage+i).map(n=>`<button class="page-btn ${n===state.page?'active':''}" data-page="${n}">${n}</button>`).join('')}<button class="page-btn" data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="Next page">›</button></div></div></div>`;
  }
  function updateResultsOnly(){if(state.route.page!=='search')return;const root=$('#results-area');if(root){root.innerHTML=renderResults();}}
  function renderProfile(id){const p=byId(id);if(!p)return `${heading('Player not found','This player ID does not exist in the active dataset.',`<button class="btn" data-route="search">Back to search</button>`)}<div class="section-card section-body">Player ID not found. Try searching for another player.</div>`;
    const groups=ATTRS.map(([title,attrs])=>`<div class="attribute-group"><h3>${title}</h3>${attrs.map(([key,label])=>{const v=p.attributes?.[key];return `<div class="attr-row"><span class="attr-label">${label}</span><span class="attr-bar"><span class="attr-fill" style="display:block;width:${Math.min(100,Math.max(0,Number(v)||0))}%"></span></span><strong class="attr-value">${fmt(v)}</strong></div>`}).join('')}</div>`).join('');
    const isSelected=state.selectedIds.has(String(p.id));
    return `${heading('Player profile',`Detailed information and PES attribute breakdown for ${esc(p.displayName)}.`,`<button class="btn" data-route="search">← ${tr('Back to search')}</button><button class="btn btn-primary" data-action="compare-player" data-id="${esc(p.id)}">⇄ ${tr('Compare this player')}${isSelected?' ✓':''}</button>`)}
    <div class="profile-hero"><div class="profile-avatar-wrap">${avatar(p,true)}</div><div class="profile-identity"><h1>${esc(p.displayName)}</h1><div class="profile-tags"><span class="position-tag">${esc(p.position)}</span><span class="profile-club-tag">${clubLogo(p.club,'sm')} ${esc(p.club)}</span><span>${esc(p.league)}</span><span>${flag(p.nationality)}${esc(p.nationality)}</span></div><div class="profile-tags" style="margin-top:8px">${p.playingStyle?`<span>◈ ${esc(p.playingStyle)}</span>`:''}<span>${esc(p.foot||'Foot unknown')} foot</span><span class="pill ${p.dataStatus==='DEMO'?'pill-amber':'pill-green'}">${p.dataStatus==='AUTHENTIC'?'SOURCED PES 2021 RECORD':(p.dataStatus==='DEMO'?'DEMO RECORD':'IMPORTED RECORD')}</span></div></div><div class="profile-rating"><strong>${fmt(p.overall)}</strong><span>Overall</span><div style="margin-top:10px;font-size:10px;color:#c8f1de">Potential ${fmt(p.potential)}</div></div></div>
    <div class="profile-info-grid"><div class="info-tile"><span>Age</span><strong>${fmt(p.age)} years</strong></div><div class="info-tile"><span>Height / Weight</span><strong>${fmt(p.height,' cm')} / ${fmt(p.weight,' kg')}</strong></div><div class="info-tile"><span>Weak foot use / accuracy</span><strong>${fmt(p.weakFootUsage)} / ${fmt(p.weakFootAccuracy)}</strong></div><div class="info-tile"><span>Form / injury resistance</span><strong>${fmt(p.form)} / ${fmt(p.injuryResistance)}</strong></div></div>
    ${p.sourceUrl?`<div class="tiny muted" style="margin:10px 0 16px;line-height:1.7">Data source: <strong>${esc(p.sourceName||'Public PES 2021 database')}</strong> · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--purple)">Open source player record ↗</a>. Potential is left unavailable when the cited profile does not supply it.</div>`:''}
    <div class="profile-layout"><div class="section-card"><div class="section-head"><div><h2>Attribute breakdown</h2><p>All available player attributes in the active dataset.</p></div><span class="pill pill-purple">${Object.values(p.attributes||{}).filter(v=>v!==null).length} values</span></div><div class="section-body"><div class="attribute-groups">${groups}</div><div class="bar-legend"><span><i class="dot"></i>Attribute rating · 0–99 scale</span><span>Missing values show as —</span></div></div></div>
    <div style="display:grid;gap:16px"><div class="section-card"><div class="section-head"><h2>Position suitability</h2></div><div class="section-body"><div class="tag-list"><span class="secondary-position">${esc(p.position)} · Main</span>${(p.secondaryPositions||[]).map(pos=>`<span class="secondary-position">${esc(pos)}</span>`).join('')||'<span class="muted tiny">No secondary positions supplied</span>'}</div></div></div><div class="section-card"><div class="section-head"><h2>Player skills</h2><span class="pill pill-purple">${(p.skills||[]).length}</span></div><div class="section-body"><div class="tag-list">${(p.skills||[]).map(s=>`<span class="skill-tag">${esc(s)}</span>`).join('')||'<span class="muted tiny">No skill data supplied</span>'}</div></div></div><div class="section-card"><div class="section-head"><h2>COM playing styles</h2></div><div class="section-body"><div class="tag-list">${(p.comPlayingStyles||[]).map(s=>`<span class="skill-tag style-tag">${esc(s)}</span>`).join('')||'<span class="muted tiny">No COM style data supplied</span>'}</div></div></div></div></div>`;
  }
  function compareOptions(){const q=String(state.compareQuery||'').trim().toLowerCase();const rows=[];const source=dataIndex.playersByName;for(const p of source){if(state.selectedIds.has(String(p.id)))continue;if(q&&!`${p.displayName} ${p.name} ${p.club} ${p.position}`.toLowerCase().includes(q))continue;rows.push(p);if(rows.length>=60)break;}return `<option value="">${q?'Choose a matching player…':'Type a name to search, or select a player…'}</option>`+rows.map(p=>`<option value="${esc(p.id)}">${esc(p.displayName)} · ${esc(p.position)} · ${fmt(p.overall)}</option>`).join('');}
  function comparePicker(){return `<div class="compare-pickers"><input class="control" id="compare-player-search" type="search" value="${esc(state.compareQuery)}" placeholder="Search player, club or position…" aria-label="Search players to compare"><select class="control" id="compare-player-select">${compareOptions()}</select><button class="btn btn-primary" data-action="add-compare-player">+ ${tr('Add Player')}</button><button class="btn" data-route="search">Find players</button></div>`;}
  function renderCompare(){const players=[...state.selectedIds].map(byId).filter(Boolean).slice(0,4);if(state.selectedIds.size>4){state.selectedIds=new Set([...state.selectedIds].slice(0,4));}
    let compareBody='';
    if(players.length>=2){
      const n=players.length;
      const header=`<div class="compare-grid" style="--compare-count:${n}">${players.map(p=>`<div class="section-card compare-player">${avatar(p)}<strong>${esc(p.displayName)}</strong><small class="compare-club-line">${clubLogo(p.club,'xs')} ${esc(p.club)} · ${esc(p.position)}</small><div class="compare-overall">${fmt(p.overall)} <span style="font:700 9px Inter,sans-serif;color:#8b86a0">OVR</span></div><small>Potential ${fmt(p.potential)}</small><button class="btn btn-sm compare-card-remove" data-action="remove-compare-player" data-id="${esc(p.id)}">− Remove</button><button class="btn btn-sm" style="margin-top:6px" data-player="${esc(p.id)}">View profile ↗</button></div>`).join('')}</div>`;
      const groups=ATTRS.map(([title,attrs])=>`<div class="compare-group">${title}</div>${attrs.map(([key,label])=>{const vals=players.map(p=>p.attributes?.[key]);const nums=vals.filter(v=>v!==null&&v!==undefined).map(Number);const max=nums.length?Math.max(...nums):null;return `<div class="compare-row" style="--compare-count:${n}"><span class="compare-metric">${label}</span>${players.map(p=>{const v=p.attributes?.[key];return `<span class="compare-val ${v!==null&&v!==undefined&&v===max?'best':''}">${fmt(v)}${v!==null&&v!==undefined?`<span class="compare-bar"><span style="width:${Math.min(100,Math.max(0,Number(v)||0))}%"></span></span>`:''}</span>`}).join('')}</div>`}).join('')}`).join('');
      const general=[['Overall','overall'],['Potential','potential'],['Age','age'],['Height','height'],['Weight','weight'],['Weak foot usage','weakFootUsage'],['Weak foot accuracy','weakFootAccuracy'],['Form','form'],['Injury resistance','injuryResistance']];
      const generals=`<div class="compare-group">General</div>${general.map(([label,key])=>{const nums=players.map(p=>p[key]).filter(v=>v!==null&&v!==undefined).map(Number);const max=['Age','Height','Weight'].includes(label)?null:(nums.length?Math.max(...nums):null);return `<div class="compare-row" style="--compare-count:${n}"><span class="compare-metric">${label}</span>${players.map(p=>`<span class="compare-val ${max!==null&&p[key]===max?'best':''}">${fmt(p[key])}</span>`).join('')}</div>`}).join('')}`;
      const skills=`<div class="compare-group">Playing style &amp; skills</div><div class="compare-row" style="--compare-count:${n}"><span class="compare-metric">Playing style</span>${players.map(p=>`<span class="compare-val">${esc(p.playingStyle||'—')}</span>`).join('')}</div><div class="compare-row" style="--compare-count:${n}"><span class="compare-metric">Skills</span>${players.map(p=>`<span class="compare-val" style="font:500 10px Inter,sans-serif;line-height:1.8;text-align:left">${(p.skills||[]).map(s=>`<span class="skill-tag" style="margin:2px">${esc(s)}</span>`).join('')||'—'}</span>`).join('')}</div>`;
      compareBody=`${header}<div class="section-card">${generals}${groups}${skills}</div>`;
    } else {compareBody=`<div class="section-card empty-state"><div class="empty-icon">⇄</div><strong>Select at least two players to compare</strong><div>Choose players from the search table or add them below. You can compare up to four.</div><div style="margin-top:15px"><button class="btn btn-primary" data-route="search">Open player search</button></div></div>`;}
    return `${heading('Player comparison','Compare actual attributes, physical traits and skills side by side.','<button class="btn" data-action="clear-compare">Clear selection</button>')}${comparePicker()}<div style="height:15px"></div>${players.length<4?`<div class="tiny muted" style="margin:0 0 12px">${players.length} of 4 comparison slots used</div>`:''}${compareBody}`;
  }
  let importedCoaches=[];
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_COACHES)||'[]');if(Array.isArray(saved))importedCoaches=saved;}catch(e){}
  const coaches=()=>{
    const curated=window.PITCHLAB_COACHES||[], official=window.PITCHLAB_PESMASTER_COACHES||[];
    const officialBySource=new Map(official.map(c=>[c.sourceUrl,c]));
    const base=curated.map(c=>{const source=officialBySource.get(c.sourceUrl);return source?{...source,...c,id:c.id,lineup:source.lineup,formation:source.formation,rating:source.rating,adaptability:source.adaptability,managementSkills:source.managementSkills,attack:source.attack,defense:source.defense,officialTacticalPresets:source.officialTacticalPresets}:c;});
    const merged=[...base,...official.filter(c=>!base.some(o=>o.sourceUrl&&o.sourceUrl===c.sourceUrl&&o.team===c.team))];
    return [...merged,...importedCoaches.filter(c=>!merged.some(o=>o.id===c.id||(c.sourceUrl&&o.sourceUrl===c.sourceUrl)))];
  };
  function coachTactics(){return coaches().flatMap(c=>{const links=Array.isArray(c.teamLinks)&&c.teamLinks.length?c.teamLinks:[{teamId:c.teamId||'',team:c.team,league:c.league}];return links.map(link=>({id:c.id,coachId:c.id,team:link.team||c.team,teamId:String(link.teamId||''),league:link.league||c.league,formation:c.formation}));});}
  function importCoachFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);const records=Array.isArray(data)?data:data.coaches;if(!Array.isArray(records))throw Error('Expected JSON array or {coaches:[]}');const valid=records.filter(c=>c&&typeof c.id==='string'&&typeof c.realName==='string'&&typeof c.team==='string'&&typeof c.formation==='string'&&c.attack&&c.defense).map(c=>({...c,gameName:c.gameName||c.realName,league:c.league||'Unknown league',lineup:Array.isArray(c.lineup)?c.lineup:[['GK']],sourceLabel:c.sourceLabel||'Imported coach',sourceUrl:c.sourceUrl||'',dataStatus:'IMPORTED'}));if(!valid.length)throw Error('No valid coaches. Required: id, realName, team, formation, attack, defense');const ids=new Set(coaches().map(c=>c.id));const added=valid.filter(c=>!ids.has(c.id));const merged=[...importedCoaches,...added];localStorage.setItem(STORAGE_COACHES,JSON.stringify(merged));importedCoaches=merged;render();notify(`${added.length} new coaches imported. Existing coach tactics preserved.`);}catch(e){notify('Coach import failed: '+e.message);}};reader.readAsText(file);}
  function diagnose(){const leagues=[...new Set([...(window.PITCHLAB_LEAGUE_CATALOG||[]),...state.players.map(p=>p.league).filter(Boolean)])];const clubs=[...new Set(state.players.map(p=>p.club).filter(Boolean))];const withoutPortrait=state.players.filter(p=>!p.portraitId&&!p.portraitUrl).length;return {players:state.players.length,leagues:leagues.length,clubs:clubs.length,coaches:coaches().length,portraitsMissing:withoutPortrait,dbStatus:state.fullDatabaseStatus,storageAvailable:!!window.indexedDB};}
  function doctorPanel(){const d=diagnose();return `<div class="section-card" style="margin-top:16px"><div class="section-head"><h2>🩺 PitchLab Diagnostic Assistant</h2><span class="pill pill-purple">LOCAL DIAGNOSTICS</span></div><div class="section-body"><p>Players: <b>${d.players}</b> · League entries: <b>${d.leagues}</b> · Clubs in current dataset: <b>${d.clubs}</b> · Coaches: <b>${d.coaches}</b> · Missing verified portrait references: <b>${d.portraitsMissing}</b></p><p id="doctor-result" role="status">${d.players<1000?'Large player database is not saved yet.':''} ${d.coaches<100?'Coach list is partial: import licensed coach records below.':''} League catalog does not guarantee full team rosters.</p><button class="btn btn-primary" data-action="doctor-fix">↻ Diagnose &amp; repair common problems</button><p class="tiny muted">Checks saved data and retries source loading when needed. Does not invent coaches, images or missing team records; a cloud AI cannot repair source files without a configured backend and credentials.</p></div></div>`;}

  function findCoach(id){return coaches().find(c=>c.id===String(id));}
  function valueLabel(v){if(v===null||v===undefined||v==='')return `<span class="muted">${tr('Not published in source')}</span>`;const labels={'Possession Game':'الاستحواذ على الكرة','Counter Attack':'هجمات مرتدة','Short-pass':'تمرير قصير','Long-pass':'تمرير طويل','Centre':'العمق','Wide':'الأطراف','Flexible':'مرن','Maintain Formation':'الحفاظ على الخطة','Frontline Pressure':'ضغط الخط الأمامي','All-out Defence':'دفاع شامل','Middle':'الوسط','Aggressive':'مكثف / عدواني','Conservative':'محافظ'};return esc(state.lang==='ar'?(labels[v]||v):v);}
  function tacticalField(label,value){return `<div class="tactic-setting"><span>${tr(label)}</span><strong>${valueLabel(value)}</strong></div>`;}
  function advancedInstructionLabel(name){const labels={'Attacking Fullbacks':'ظهيران مهاجمان','Gegenpress':'ضغط معاكس'};return esc(state.lang==='ar'?(labels[name]||name):name);}
  function renderCustomTacticalPreset(c,title,preset,kind){
    const attack={...c.attack,supportRange:preset.supportRange};
    const defense={...c.defense,defensiveLine:preset.defensiveLine,compactness:preset.compactness};
    return `<section class="section-card tactic-preset-card"><div class="section-head"><div><h2>${tr(title)}</h2><p>${state.lang==='ar'?'إعدادات ليفربول المخصصة':'Liverpool custom tactical setup'}</p></div><span class="pill ${kind==='attacking'?'pill-purple':'pill-gray'}">${kind==='attacking'?'ATTACK':'DEFENCE'}</span></div><div class="tactic-preset-groups"><div><h3>${tr('Attack group')}</h3><div class="tactic-settings">${tacticalField('Attacking style',attack.style)}${tacticalField('Build up',attack.buildUp)}${tacticalField('Attacking area',attack.area)}${tacticalField('Positioning',attack.positioning)}${tacticalField('Support range',attack.supportRange)}</div></div><div><h3>${tr('Defence group')}</h3><div class="tactic-settings">${tacticalField('Defensive style',defense.style)}${tacticalField('Containment area',defense.containment)}${tacticalField('Pressuring',defense.pressuring)}${tacticalField('Defensive line',defense.defensiveLine)}${tacticalField('Compactness',defense.compactness)}</div></div></div><div class="tactic-instructions"><h3>${tr('Advanced instructions')}</h3><div class="instruction-chips">${(preset.advancedInstructions||[]).map(x=>`<span class="instruction-chip">${advancedInstructionLabel(x)}</span>`).join('')}</div></div></section>`;
  }
  function renderTacticalSections(c){
    if(c.officialTacticalPresets){const presets=c.officialTacticalPresets;return `<div class="tactical-preset-grid">${renderOfficialTacticalPreset('Attacking tactic',presets.attacking,'attacking')}${renderOfficialTacticalPreset('Defensive tactic',presets.defensive,'defensive')}${c.tacticalPresets?renderCustomTacticalPreset(c,'Liverpool custom attacking tactic',c.tacticalPresets.attacking,'attacking')+renderCustomTacticalPreset(c,'Liverpool custom defensive tactic',c.tacticalPresets.defensive,'defensive'):''}</div>`;}
    if(c.tacticalPresets){return `<div class="tactical-preset-grid">${renderCustomTacticalPreset(c,'Attacking tactic',c.tacticalPresets.attacking,'attacking')}${renderCustomTacticalPreset(c,'Defensive tactic',c.tacticalPresets.defensive,'defensive')}</div>`;}
    return `<div class="tactical-columns"><section class="section-card"><div class="section-head"><div><h2>${tr('Attack settings')}</h2><p>${state.lang==='ar'?'إعدادات بناء الهجمة':'Attacking preset'}</p></div><span class="pill pill-purple">ATTACK</span></div><div class="tactic-settings">${tacticalField('Attacking style',c.attack.style)}${tacticalField('Build up',c.attack.buildUp)}${tacticalField('Attacking area',c.attack.area)}${tacticalField('Positioning',c.attack.positioning)}${tacticalField('Support range',c.attack.supportRange)}</div></section><section class="section-card"><div class="section-head"><div><h2>${tr('Defence settings')}</h2><p>${state.lang==='ar'?'إعدادات الدفاع بدون كرة':'Defensive preset'}</p></div><span class="pill pill-gray">DEFENCE</span></div><div class="tactic-settings">${tacticalField('Defensive style',c.defense.style)}${tacticalField('Containment area',c.defense.containment)}${tacticalField('Pressuring',c.defense.pressuring)}${tacticalField('Defensive line',c.defense.defensiveLine)}${tacticalField('Compactness',c.defense.compactness)}</div></section></div>`;
  }
  function renderOfficialTacticalPreset(title,preset,kind){
    if(!preset)return '';
    const attack=preset.attack||{},defense=preset.defense||{};
    return `<section class="section-card tactic-preset-card"><div class="section-head"><div><h2>${tr(title)}</h2><p>${state.lang==='ar'?'بيانات الخطة من صفحة المدرب الرسمية':'Source values from the official coach profile'}</p></div><span class="pill ${kind==='attacking'?'pill-purple':'pill-gray'}">${kind==='attacking'?'ATTACK':'DEFENCE'}</span></div><div class="tactic-preset-groups"><div><h3>${tr('Attack group')}</h3><div class="tactic-settings">${tacticalField('Attacking style',attack.style)}${tacticalField('Build up',attack.buildUp)}${tacticalField('Attacking area',attack.area)}${tacticalField('Positioning',attack.positioning)}${tacticalField('Support range',attack.supportRange)}</div></div><div><h3>${tr('Defence group')}</h3><div class="tactic-settings">${tacticalField('Defensive style',defense.style)}${tacticalField('Containment area',defense.containment)}${tacticalField('Pressuring',defense.pressuring)}${tacticalField('Defensive line',defense.defensiveLine)}${tacticalField('Compactness',defense.compactness)}</div></div></div><div class="tactic-instructions"><h3>${tr('Advanced instructions')}</h3><div class="instruction-chips"><span class="muted">${state.lang==='ar'?'غير منشورة في ملف المصدر':'Not published on the source profile'}</span></div></div></section>`;
  }
  function renderCustomPresetSummary(c){
    if(!c.tacticalPresets)return '';
    const a=c.tacticalPresets.attacking||{}, d=c.tacticalPresets.defensive||{};
    const line=(title,p)=>`<div class="custom-preset-line"><strong>${tr(title)}</strong><span>${tr('Support range')} <b>${fmt(p.supportRange)}</b> · ${tr('Defensive line')} <b>${fmt(p.defensiveLine)}</b> · ${tr('Compactness')} <b>${fmt(p.compactness)}</b></span></div>`;
    const instructions=[...new Set([...(a.advancedInstructions||[]),...(d.advancedInstructions||[])])];
    return `<div class="custom-preset-mini">${line('Attacking tactic',a)}${line('Defensive tactic',d)}<div class="instruction-chips">${instructions.map(x=>`<span class="instruction-chip">${advancedInstructionLabel(x)}</span>`).join('')}</div></div>`;
  }
  function renderTacticsProvenance(c){
    if(c.tacticalPresets)return `<section class="section-card advanced-note"><h3>${tr('Custom Liverpool settings')}</h3><p>${tr('Liverpool settings supplied by you. They are shown as your chosen setup, not as verified original hidden PESMASTER values.')}</p></section>`;
    return `<section class="section-card advanced-note"><h3>${tr('Advanced instructions')}</h3><p>${state.lang==='ar'?'التعليمات المتقدمة مثل الضغط المضاد أو الظهيرين الهجوميين غير موثقة في صفحة سجل المدرب هنا. يمكن إضافتها كسجل منفصل عند توفر مصدر موثوق أو استيراد ملف التكتيكات.':'Advanced instructions such as Gegenpress or Attacking Fullbacks are not documented on this manager profile. Add them as a separate record once a reliable source or tactics file is available.'}</p></section>`;
  }
  function renderTacticsSourceNote(c){const base=`🔗 ${tr('Source profile')}: <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.sourceLabel)} ↗</a>`;return `<div class="source-note">${base}${c.tacticalPresets?'':`. ${tr('The source does not publish these hidden values, so they are left blank rather than guessed.')}`}</div>`;}
  function renderCoachCard(c){return `<article class="section-card coach-card" data-coach-card data-search="${esc([c.realName,c.gameName,c.team,c.league,c.formation,c.attack.style,c.defense.style].join(' ').toLowerCase())}"><div class="coach-card-head"><div class="coach-badge">${esc(c.formation)}</div><div class="grow"><h3>${esc(c.realName)}</h3><p>${esc(c.gameName)}</p></div><span class="manager-rating">${fmt(c.rating)}</span></div><div class="coach-meta"><span class="coach-team-meta">${clubLogo(c.team,'sm')} ${esc(c.team)}</span><span>⌁ ${esc(c.league)}</span><span>◈ ${tr('Adaptability')}: ${fmt(c.adaptability)}</span></div><div class="coach-tags"><span>${valueLabel(c.attack.style)}</span><span>${valueLabel(c.attack.buildUp)}</span><span>${valueLabel(c.defense.pressuring)} ${state.lang==='ar'?'الضغط':'pressure'}</span></div>${renderCustomPresetSummary(c)}<div class="coach-card-footer"><span>${tr(c.tacticalPresets?'Custom Liverpool settings':'Default PES 2021 settings')}</span><button class="btn btn-sm btn-primary" data-route="coach/${esc(c.id)}">${tr('View coach')} →</button></div></article>`;}
  function renderCoaches(){const rows=coaches();return `${heading(tr('Coaches'),tr('Browse PES 2021 managers and their in-game tactical presets.'),`<button class="btn btn-primary" data-route="tactics">⌘ ${tr('Team Tactics')}</button>`)}<div class="section-card tactics-intro"><div class="intro-symbol">♟</div><div><strong>${rows.length} ${tr('Coach records')}</strong><p>${tr('Tactical presets are in-game database values, not a claim that every real match uses the exact same setup.')}</p></div></div><div class="database-toolbar"><label class="manager-search">⌕ <input id="coach-search" type="search" value="${esc(state.coachQuery)}" placeholder="${tr('Search coaches by name, team, or formation…')}"></label><span class="pill pill-purple" id="coach-count">${rows.length} ${state.lang==='ar'?'مدربين':'managers'}</span></div><div class="coach-grid" id="coach-grid">${rows.map(renderCoachCard).join('')}</div><div class="section-card section-body" style="margin-top:16px"><strong>Import more PES 2021 coaches</strong><p>Choose a licensed JSON dataset of manager records. Existing PESMASTER profiles and Liverpool's custom presets will not be replaced.</p><input type="file" id="coach-file" accept=".json,application/json"><p class="tiny muted">Required: id, realName, team, formation, attack and defense objects. Imported records are stored locally.</p></div>${renderTeamsWithoutCoach()}<div class="source-note">ⓘ ${state.lang==='ar'?'القيم مأخوذة من ملفات المدربين الرسمية، والتعليمات المتقدمة تظهر فقط إذا نشرها المصدر.':'Values are sourced from the linked coach profiles; advanced instructions appear only when the source publishes them.'} <a href="https://www.pesmaster.com/pes-2021/coach/" target="_blank" rel="noopener noreferrer">PESMASTER Managers Search ↗</a></div>`;}
  function renderLineup(c){const rows=[...(c.lineup||[])].reverse();return `<div class="tactic-pitch" aria-label="${esc(c.formation)} formation, attacking direction toward the top"><div class="pitch-direction pitch-direction-top">${state.lang==='ar'?'↑ اتجاه الهجوم':'↑ ATTACK'}</div><div class="pitch-marking"></div><div class="tactic-pitch-rows">${rows.map((row,i)=>{const midfieldRow=row.length===3&&row.filter(pos=>pos==='DMF').length===1&&row.filter(pos=>pos==='CMF').length===2?['CMF','DMF','CMF']:row;return `<div class="tactic-pitch-row" data-row="${i}">${midfieldRow.map(pos=>`<span class="tactic-position">${esc(pos)}</span>`).join('')}</div>`}).join('')}</div><div class="pitch-direction pitch-direction-bottom">${state.lang==='ar'?'حارس المرمى ↓':'GOALKEEPER ↓'}</div><div class="pitch-caption">${esc(c.formation)} · ${state.lang==='ar'?'الهجوم للأعلى وحارس المرمى بالأسفل':'attack at the top, goalkeeper at the bottom'}</div></div>`;}

  function renderCoachDetail(id){const c=findCoach(id);if(!c)return `${heading(tr('Coaches'),'Coach record was not found.',`<button class="btn" data-route="coaches">${tr('Back')}</button>`)}<div class="section-card section-body">Coach record was not found.</div>`;return `${heading(esc(c.realName),`${tr('Tactical profile')} · ${esc(c.gameName)}`,`<button class="btn" data-route="coaches">← ${tr('Coaches')}</button><button class="btn btn-primary" data-route="tactic/${esc(c.id)}">⌘ ${tr('View team tactics')}</button>`)}<div class="coach-profile-hero section-card"><div class="coach-profile-badges">${clubLogo(c.team,'xl')}<div class="coach-badge coach-badge-large">${esc(c.formation)}</div></div><div class="coach-profile-identity"><div class="eyebrow">${tr('Official game profile')} · PES 2021</div><h2>${esc(c.realName)}</h2><p>${esc(c.gameName)} · ${esc(c.team)} · ${esc(c.league)}</p><div class="coach-tags"><span>${valueLabel(c.attack.style)}</span><span>${valueLabel(c.attack.buildUp)}</span><span>${valueLabel(c.defense.pressuring)} ${state.lang==='ar'?'الضغط':'pressure'}</span></div></div><div class="manager-rating-block"><strong>${fmt(c.rating)}</strong><span>${state.lang==='ar'?'تقييم المدرب':'Manager rating'}</span></div></div><div class="coach-facts-grid"><div class="info-tile"><span>${tr('Formation')}</span><strong>${esc(c.formation)}</strong></div><div class="info-tile"><span>${tr('Adaptability')}</span><strong>${fmt(c.adaptability)}</strong></div><div class="info-tile"><span>${tr('Management Skills')}</span><strong>${fmt(c.managementSkills)}</strong></div><div class="info-tile"><span>${tr('Nationality')}</span><strong>${esc(c.nationality)}</strong></div></div><div class="section-heading-inline"><div><h2>${state.lang==='ar'?'رسم الخطة':'Formation board'}</h2><p>${state.lang==='ar'?'تمثيل مبسّط للمراكز الواردة في صفحة المدرب':'Simplified layout of the positions listed by the source.'}</p></div></div>${renderLineup(c)}${renderTacticalSections(c)}${renderTacticsProvenance(c)}${renderTacticsSourceNote(c)}`;}
  function renderTacticCard(t){const c=findCoach(t.coachId);return `<article class="section-card team-tactic-card" data-tactic-card data-search="${esc([t.team,t.league,c.realName,c.gameName,t.formation,c.attack?.style].filter(Boolean).join(' ').toLowerCase())}" data-style="${esc(c.attack.style)}"><div class="team-tactic-banner">${clubLogo(t.team,'xl')}<span class="formation-chip">${esc(t.formation)}</span></div><div class="team-tactic-content"><div class="eyebrow">${esc(t.league)}</div><h3>${esc(t.team)}</h3><p class="team-coach-line">${state.lang==='ar'?'المدرب':'Manager'}: ${esc(c.realName)} <span>(${esc(c.gameName)})</span></p><div class="team-tactic-summary"><div><small>${tr('Attacking style')}</small><strong>${valueLabel(c.attack.style)}</strong></div><div><small>${tr('Build up')}</small><strong>${valueLabel(c.attack.buildUp)}</strong></div><div><small>${tr('Defensive style')}</small><strong>${valueLabel(c.defense.style)}</strong></div><div><small>${tr('Pressuring')}</small><strong>${valueLabel(c.defense.pressuring)}</strong></div></div>${renderCustomPresetSummary(c)}<div class="team-tactic-bottom"><span>${tr(c.tacticalPresets?'Custom Liverpool settings':'Source profile linked')}</span><button class="btn btn-sm btn-primary" data-route="tactic/${esc(t.id)}/${encodeURIComponent(t.teamId)}">${state.lang==='ar'?'عرض التكتيك':'View tactics'} →</button></div></div></article>`;}
  function renderTactics(){const rows=coachTactics();const styles=[...new Set(rows.map(t=>findCoach(t.coachId)?.attack.style).filter(Boolean))];return `${heading(tr('Team Tactics'),tr('Explore default team tactics from the PES 2021 coach database.'),`<button class="btn" data-route="coaches">♟ ${tr('Coaches')}</button>`)}<div class="section-card tactics-intro"><div class="intro-symbol">⌘</div><div><strong>${rows.length} ${tr('Teams with tactical data')}</strong><p>${tr('Tactical presets are in-game database values, not a claim that every real match uses the exact same setup.')}</p></div></div><div class="database-toolbar"><label class="manager-search">⌕ <input id="tactics-search" type="search" value="${esc(state.tacticQuery)}" placeholder="${tr('Search teams or tactical styles…')}"></label><select id="tactics-style-filter" class="tactic-filter"><option value="ALL">${tr('All attacking styles')}</option>${styles.map(x=>`<option value="${esc(x)}" ${state.tacticStyle===x?'selected':''}>${valueLabel(x)}</option>`).join('')}</select><span class="pill pill-purple" id="tactics-count">${rows.length} ${state.lang==='ar'?'فرق':'teams'}</span></div><div class="tactics-card-grid" id="tactics-card-grid">${rows.map(renderTacticCard).join('')}</div><div class="source-note">ⓘ ${state.lang==='ar'?'القيم مأخوذة من ملفات المدربين الرسمية، والتعليمات المتقدمة تظهر فقط إذا نشرها المصدر.':'Values are sourced from the linked coach profiles; advanced instructions appear only when the source publishes them.'} <a href="https://www.pesmaster.com/pes-2021/coach/" target="_blank" rel="noopener noreferrer">PESMASTER Managers Search ↗</a></div>${renderTeamsWithoutCoach()}`;}
  function renderTeamsWithoutCoach(){const teams=window.PITCHLAB_TEAMS_WITHOUT_COACH||[];if(!teams.length)return '';return `<details class="section-card" style="margin-top:16px;padding:16px"><summary style="cursor:pointer;font-weight:700">${teams.length} ${state.lang==='ar'?'فريق لا توجد له صفحة مدرب مرتبطة في PESMASTER':'teams with no linked PESMASTER coach profile'}</summary><div class="tag-list" style="margin-top:12px">${teams.map(t=>`<a class="secondary-position" href="${esc(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t.name)} ↗</a>`).join('')}</div><p class="tiny muted">${state.lang==='ar'?'مافيش بيانات مدرب أو تكتيك منشورة في رابط الفريق الرسمي.':'The linked official team pages do not publish manager profiles for these teams.'}</p></details>`;}
  function renderTacticDetail(id,teamId){const source=findCoach(id);if(!source)return `${heading(tr('Team Tactics'),'Tactics record was not found.',`<button class="btn" data-route="tactics">${tr('Back')}</button>`)}<div class="section-card section-body">Tactics record was not found.</div>`;const link=(source.teamLinks||[]).find(item=>String(item.teamId||'')===String(teamId||''));const c=link?{...source,team:link.team||source.team,league:link.league||source.league,teamId:String(link.teamId)}:source;return `${heading(`${esc(c.team)} — ${tr('Team Tactics')}`,`${tr('Default PES 2021 settings')} · ${esc(c.formation)}`,`<button class="btn" data-route="tactics">← ${tr('Team Tactics')}</button><button class="btn btn-primary" data-route="coach/${esc(c.id)}">♟ ${tr('View coach')}</button>`)}<div class="coach-profile-hero section-card"><div class="coach-profile-badges">${clubLogo(c.team,'xl')}<div class="coach-badge coach-badge-large">${esc(c.formation)}</div></div><div class="coach-profile-identity"><div class="eyebrow">${tr('Official game profile')} · PES 2021</div><h2>${esc(c.team)}</h2><p>${esc(c.realName)} · ${esc(c.gameName)} · ${esc(c.league)}</p><div class="coach-tags"><span>${valueLabel(c.attack.style)}</span><span>${valueLabel(c.attack.area)}</span><span>${valueLabel(c.defense.pressuring)} ${state.lang==='ar'?'الضغط':'pressure'}</span></div></div><div class="manager-rating-block"><strong>${esc(c.formation)}</strong><span>${tr('Formation')}</span></div></div><div class="section-heading-inline"><div><h2>${state.lang==='ar'?'توزيع المراكز':'Position layout'}</h2><p>${state.lang==='ar'?'تشكيل بصري مستند إلى سجل المدرب داخل PES 2021':'Visual layout based on the in-game manager record.'}</p></div></div>${renderLineup(c)}${renderTacticalSections(c)}${renderTacticsProvenance(c)}${renderTacticsSourceNote(c)}`;}

  function masterLeagueCompetitions(){
    return (state.officialLeagues||[]).map(league=>({league,teams:state.officialTeams.filter(team=>(team.leagues||[]).some(link=>String(link.leagueId)===String(league.leagueId)))})).filter(item=>item.teams.length>=2).sort((a,b)=>a.league.name.localeCompare(b.league.name));
  }
  function masterLeagueTeamsFor(leagueId){return state.officialTeams.filter(team=>(team.leagues||[]).some(link=>String(link.leagueId)===String(leagueId))).sort((a,b)=>a.name.localeCompare(b.name));}
  function masterLeagueSchedule(teamIds){
    let rotation=teamIds.slice();if(rotation.length%2)rotation.push('');
    const firstLeg=[];
    for(let round=0;round<rotation.length-1;round++){
      const fixtures=[];for(let i=0;i<rotation.length/2;i++){const left=rotation[i],right=rotation[rotation.length-1-i];if(!left||!right)continue;const swap=(round+i)%2===1;fixtures.push({home:swap?right:left,away:swap?left:right});}
      firstLeg.push(fixtures);rotation=[rotation[0],rotation[rotation.length-1],...rotation.slice(1,-1)];
    }
    return firstLeg.concat(firstLeg.map(fixtures=>fixtures.map(match=>({home:match.away,away:match.home}))));
  }
  function masterLeagueHash(value){let hash=2166136261;for(const char of String(value||''))hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;}
  function masterLeagueStrength(teamId){
    const team=state.officialTeamsById.get(String(teamId)),players=team?(dataIndex.playersByClub.get(team.name)||[]):[];
    const ratings=players.map(player=>Number(player.overall)).filter(value=>Number.isFinite(value)&&value>0);
    if(ratings.length>=11)return Math.round(ratings.reduce((sum,value)=>sum+value,0)/ratings.length);
    return 70+masterLeagueHash(`${teamId}:${team?.name||''}`)%18;
  }
  function masterLeagueRandom(seed){let value=seed|0;return ()=>{value=(value+0x6D2B79F5)|0;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function masterLeaguePoisson(lambda,random){const limit=Math.exp(-lambda);let product=1,count=0;do{count++;product*=random();}while(product>limit&&count<9);return count-1;}
  function persistMasterLeague(){try{if(state.masterLeagueCampaign)localStorage.setItem(STORAGE_MASTER_LEAGUE,JSON.stringify(state.masterLeagueCampaign));else localStorage.removeItem(STORAGE_MASTER_LEAGUE);}catch(error){console.warn('Master League save failed:',error);notify(state.lang==='ar'?'تعذر حفظ الموسم في هذا المتصفح.':'Could not save this season in the browser.');}}
  function startMasterLeagueCareer(){
    const league=state.officialLeagues.find(item=>String(item.leagueId)===String(state.masterLeagueLeagueId));
    const teams=masterLeagueTeamsFor(state.masterLeagueLeagueId),team=teams.find(item=>String(item.teamId)===String(state.masterLeagueTeamId));
    if(!league||!team||teams.length<2){notify(state.lang==='ar'?'اختار دوريًا وفريقًا صالحين أولًا.':'Choose a valid league and team first.');return;}
    const teamIds=teams.map(item=>String(item.teamId));state.masterLeagueCampaign={version:1,leagueId:String(league.leagueId),leagueName:league.name,teamId:String(team.teamId),teamName:team.name,teamIds,season:1,seed:(Date.now()^masterLeagueHash(team.teamId))>>>0,schedule:masterLeagueSchedule(teamIds),results:[],createdAt:new Date().toISOString()};
    state.masterLeagueLeagueId=String(league.leagueId);state.masterLeagueTeamId=String(team.teamId);persistMasterLeague();render();notify(state.lang==='ar'?'بدأ الموسم الجديد.':'Your new season has started.');
  }
  function simulateMasterLeagueMatchday(){
    const career=state.masterLeagueCampaign;if(!career)return;const matchday=career.results.length,fixtures=career.schedule[matchday];
    if(!fixtures){notify(state.lang==='ar'?'انتهى الموسم.':'The season is complete.');return;}
    const random=masterLeagueRandom((career.seed+Math.imul(matchday+1,0x9E3779B9))>>>0);
    const games=fixtures.map(fixture=>{const homePower=masterLeagueStrength(fixture.home),awayPower=masterLeagueStrength(fixture.away),difference=(homePower-awayPower)/20;return {...fixture,homeGoals:masterLeaguePoisson(Math.max(.25,Math.min(2.8,1.32+difference+.12)),random),awayGoals:masterLeaguePoisson(Math.max(.25,Math.min(2.8,1.08-difference)),random)};});
    career.results.push({matchday:matchday+1,games,playedAt:new Date().toISOString()});persistMasterLeague();render();
  }
  function masterLeagueTable(career){
    const rows=new Map(career.teamIds.map(id=>[String(id),{teamId:String(id),team:state.officialTeamsById.get(String(id)),played:0,won:0,drawn:0,lost:0,for:0,against:0,points:0}]));
    for(const round of career.results)for(const game of round.games||[]){const home=rows.get(String(game.home)),away=rows.get(String(game.away));if(!home||!away)continue;home.played++;away.played++;home.for+=game.homeGoals;home.against+=game.awayGoals;away.for+=game.awayGoals;away.against+=game.homeGoals;if(game.homeGoals>game.awayGoals){home.won++;home.points+=3;away.lost++;}else if(game.homeGoals<game.awayGoals){away.won++;away.points+=3;home.lost++;}else{home.drawn++;away.drawn++;home.points++;away.points++;}}
    return [...rows.values()].map(row=>({...row,difference:row.for-row.against})).sort((a,b)=>b.points-a.points||b.difference-a.difference||b.for-a.for||String(a.team?.name||a.teamId).localeCompare(String(b.team?.name||b.teamId)));
  }
  function masterLeagueFixtureMarkup(game,career){
    const home=state.officialTeamsById.get(String(game.home)),away=state.officialTeamsById.get(String(game.away)),mine=String(game.home)===String(career.teamId)||String(game.away)===String(career.teamId);
    return `<div class="ml-fixture ${mine?'ml-user-fixture':''}"><span class="ml-fixture-team">${clubLogo(home?.name||game.home,'sm')}<b>${esc(home?.name||game.home)}</b></span><strong class="ml-score">${game.homeGoals} <i>–</i> ${game.awayGoals}</strong><span class="ml-fixture-team away">${clubLogo(away?.name||game.away,'sm')}<b>${esc(away?.name||game.away)}</b></span>${mine?`<span class="ml-you-badge">${state.lang==='ar'?'فريقك':'YOU'}</span>`:''}</div>`;
  }
  function renderMasterLeague(){
    if(!state.teamCatalogScriptLoaded&&!Array.isArray(window.PITCHLAB_PESMASTER_TEAM_CATALOG)){const failed=state.teamCatalogScriptFailed;return `${heading(tr('Master League'),state.lang==='ar'?'اختار ناديك وابدأ موسم دوري كامل.':'Choose your club and start a full league season.',`<button class="btn" data-action="refresh-team-catalog">↻ ${state.lang==='ar'?'إعادة التحميل':'Retry loading teams'}</button>`)}<div class="section-card section-body">${failed?(state.lang==='ar'?'تعذر تحميل فهرس الفرق. جرّب إعادة التحميل.':'The official team list could not be loaded. Try again.'):(state.lang==='ar'?'جارٍ تحميل الدوريات والفرق الرسمية…':'Loading the official leagues and teams…')}</div>`;}
    if(state.masterLeagueCampaign)return renderMasterLeagueCareer(state.masterLeagueCampaign);
    const competitions=masterLeagueCompetitions();if(!competitions.length)return `${heading(tr('Master League'),state.lang==='ar'?'ابدأ موسمًا محليًا واختر النادي الذي ستديره.':'Start a local season and choose the club you will manage.') }<div class="section-card section-body">${state.lang==='ar'?'لا توجد مسابقات بها فريقان على الأقل في فهرس الفرق.':'No competition with at least two teams is available in the team catalogue.'}</div>`;
    if(!competitions.some(item=>String(item.league.leagueId)===String(state.masterLeagueLeagueId)))state.masterLeagueLeagueId=String(competitions[0].league.leagueId);
    const teams=masterLeagueTeamsFor(state.masterLeagueLeagueId);if(!teams.some(team=>String(team.teamId)===String(state.masterLeagueTeamId)))state.masterLeagueTeamId=String(teams[0]?.teamId||'');
    return `${heading(tr('Master League'),state.lang==='ar'?'اختار الدوري والفريق، والعب موسمًا كاملًا. اضغط تخطي المباراة لمحاكاة مباراتك وكل مباريات الجولة.':'Choose a league and team for a full season. Skip the match to simulate your fixture and every other game in the round.')}<div class="master-league-setup"><div class="ml-setup-emblem">♛</div><div class="ml-setup-copy"><span class="eyebrow">PES 2021 · CAREER MODE</span><h2>${state.lang==='ar'?'ابدأ مشوارك':'Start your career'}</h2><p>${state.lang==='ar'?'كل جولة تُلعب بالكامل، والنتائج تحدّث جدول الدوري وتُحفظ في هذا المتصفح.':'Every match in each round is simulated; results update the table and are saved in this browser.'}</p></div><div class="ml-select-grid"><label>${state.lang==='ar'?'الدوري':'League'}<select id="ml-league-select" class="control">${competitions.map(item=>`<option value="${esc(item.league.leagueId)}" ${String(item.league.leagueId)===String(state.masterLeagueLeagueId)?'selected':''}>${esc(item.league.name)} · ${item.teams.length}</option>`).join('')}</select></label><label>${state.lang==='ar'?'الفريق':'Team'}<select id="ml-team-select" class="control">${teams.map(team=>`<option value="${esc(team.teamId)}" ${String(team.teamId)===String(state.masterLeagueTeamId)?'selected':''}>${esc(team.name)}</option>`).join('')}</select></label><button class="btn btn-primary ml-start-button" data-action="master-league-start">♛ ${state.lang==='ar'?'ابدأ الموسم':'Start season'}</button></div><p class="ml-local-note">${state.lang==='ar'?'وضع لعب محلي بمحاكاة النتائج؛ لا يغيّر بيانات PESMASTER الأصلية.':'Local season simulation; official PESMASTER data stays unchanged.'}</p></div>`;
  }
  function renderMasterLeagueCareer(career){
    const completed=career.results.length,total=career.schedule.length,finished=completed>=total,table=masterLeagueTable(career),leader=table[0],ownRow=table.find(row=>row.teamId===String(career.teamId)),last=career.results[career.results.length-1],next=career.schedule[completed],nextOwn=next?.find(game=>String(game.home)===String(career.teamId)||String(game.away)===String(career.teamId)),nextOpponent=nextOwn?state.officialTeamsById.get(String(nextOwn.home)===String(career.teamId)?String(nextOwn.away):String(nextOwn.home)):null;
    const titleTeam=state.officialTeamsById.get(String(career.teamId)),nextText=finished?(state.lang==='ar'?'اكتمل الموسم':'Season complete'):nextOwn?(state.lang==='ar'?`الجولة ${completed+1} · ${nextOwn.home===career.teamId?'على ملعبك':'خارج ملعبك'} ضد ${nextOpponent?.name||'—'}`:`Matchday ${completed+1} · ${String(nextOwn.home)===String(career.teamId)?'Home':'Away'} vs ${nextOpponent?.name||'—'}`):(state.lang==='ar'?`الجولة ${completed+1} · راحة لفريقك`:`Matchday ${completed+1} · your team has a bye`);
    const actions=finished?`<button class="btn btn-primary" data-action="master-league-next-season">↻ ${state.lang==='ar'?'ابدأ الموسم التالي':'Start next season'}</button>`:`<button class="btn btn-primary" data-action="master-league-simulate">⏭ ${state.lang==='ar'?'تخطي المباراة':'Skip match'} · ${state.lang==='ar'?'العب الجولة كاملة':'Simulate full matchday'}</button>`;
    const fixtures=last?.games?.length?last.games.map(game=>masterLeagueFixtureMarkup(game,career)).join(''):`<div class="ml-empty-results">${state.lang==='ar'?'لم تُلعب مباريات بعد. اضغط «تخطي المباراة» لعرض نتيجتك ونتائج جميع الفرق.':'No matches played yet. Click “Skip match” to see your result and every league result.'}</div>`;
    const previous=career.results.slice(0,-1).reverse().map(round=>`<details class="ml-history-round"><summary>${state.lang==='ar'?`الجولة ${round.matchday}`:`Matchday ${round.matchday}`} · ${round.games.length} ${state.lang==='ar'?'مباريات':'matches'}</summary><div class="ml-fixture-list">${round.games.map(game=>masterLeagueFixtureMarkup(game,career)).join('')}</div></details>`).join('');
    const rows=table.map((row,index)=>`<tr class="${row.teamId===String(career.teamId)?'ml-your-row':''}"><td class="ml-position">${index+1}</td><td class="ml-table-team">${clubLogo(row.team?.name||row.teamId,'sm')}<span>${esc(row.team?.name||row.teamId)}${row.teamId===String(career.teamId)?` <em>${state.lang==='ar'?'أنت':'YOU'}</em>`:''}</span></td><td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td>${row.for}</td><td>${row.against}</td><td>${row.difference>0?'+':''}${row.difference}</td><td><strong>${row.points}</strong></td></tr>`).join('');
    if(!state.coachDataScriptLoaded&&!state.coachDataPromise&&!state.coachDataScriptFailed)ensureCoachData();
    const teamId=String(career.teamId),roster=state.officialRosters.get(teamId),rosterError=state.officialRosterErrors.get(teamId);
    if(!roster&&!state.officialRosterLoading.has(teamId)&&!rosterError)requestOfficialTeamRoster(teamId);
    const squadPanel=roster?`<div class="ml-squad-grid">${renderTeamLineup(titleTeam,roster)}<section class="section-card ml-roster-card"><div class="section-head"><div><h2>${state.lang==='ar'?'قائمة فريقك':'Your squad'}</h2><p>${state.lang==='ar'?'القائمة الرسمية للاعبين مع صورهم وتقييماتهم':'Official roster with player portraits and ratings'}</p></div><span class="pill pill-green">${roster.length}</span></div><div class="ml-roster">${renderOfficialRosterRows(roster)}</div></section></div>`:`<div class="section-card section-body ml-roster-loading">${rosterError?`<p>${esc(rosterError)}</p><button class="btn btn-primary" data-action="retry-team-roster" data-id="${esc(teamId)}">${state.lang==='ar'?'إعادة تحميل القائمة':'Retry squad load'}</button>`:(state.lang==='ar'?'جارٍ تحميل قائمة فريقك الرسمية…':'Loading your official squad…')}</div>`;
    return `${heading(`${clubLogo(titleTeam?.name||career.teamName,'md')} ${esc(titleTeam?.name||career.teamName)} · ${tr('Master League')}`,`${esc(career.leagueName)} · ${state.lang==='ar'?`الموسم ${career.season}`:`Season ${career.season}`}`,actions)}<div class="ml-career-summary"><div class="ml-career-hero"><div><span class="eyebrow">${esc(career.leagueName)} · ${state.lang==='ar'?`الموسم ${career.season}`:`SEASON ${career.season}`}</span><h2>${esc(titleTeam?.name||career.teamName)}</h2><p>${nextText}</p></div>${clubLogo(titleTeam?.name||career.teamName,'xl')}<div class="ml-round-progress"><strong>${completed}/${total}</strong><span>${state.lang==='ar'?'جولة مكتملة':'matchdays played'}</span></div></div><div class="ml-quick-stats"><div><small>${state.lang==='ar'?'المركز':'Position'}</small><strong>${table.findIndex(row=>row.teamId===String(career.teamId))+1} / ${table.length}</strong></div><div><small>${state.lang==='ar'?'النقاط':'Points'}</small><strong>${ownRow?.points||0}</strong></div><div><small>${state.lang==='ar'?'فوز · تعادل · خسارة':'W · D · L'}</small><strong>${ownRow?.won||0} · ${ownRow?.drawn||0} · ${ownRow?.lost||0}</strong></div><div><small>${state.lang==='ar'?'المتصدر':'League leader'}</small><strong>${esc(leader?.team?.name||'—')}</strong></div></div></div>${squadPanel}<div class="ml-main-grid"><section class="section-card ml-results-card"><div class="section-head"><div><h2>${last?(state.lang==='ar'?`نتائج الجولة ${last.matchday}`:`Matchday ${last.matchday} results`):(state.lang==='ar'?'نتائج المباريات':'Match results')}</h2><p>${state.lang==='ar'?'مباراة فريقك وكل مباريات الدوري في الجولة':'Your match and every league match from the round'}</p></div><span class="pill pill-purple">${last?.games?.length||0} ${state.lang==='ar'?'مباريات':'matches'}</span></div><div class="ml-fixture-list">${fixtures}</div>${previous?`<details class="ml-history"><summary>${state.lang==='ar'?'سجل الجولات السابقة':'Previous matchdays'}</summary>${previous}</details>`:''}</section><section class="section-card ml-table-card"><div class="section-head"><div><h2>${state.lang==='ar'?'جدول الدوري':'League table'}</h2><p>${state.lang==='ar'?'يُحدّث تلقائيًا بعد كل جولة':'Updates after every matchday'}</p></div><span class="pill pill-green">${table.length} ${state.lang==='ar'?'فريق':'teams'}</span></div><div class="ml-table-scroll"><table class="ml-table"><thead><tr><th>#</th><th>${state.lang==='ar'?'الفريق':'Team'}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div></section></div><div class="ml-bottom-actions"><button class="btn" data-action="master-league-new-career">${state.lang==='ar'?'اختيار فريق آخر / بداية جديدة':'Choose another team / new career'}</button><span>${state.lang==='ar'?'التقدم محفوظ تلقائيًا في هذا المتصفح.':'Progress is saved automatically in this browser.'}</span></div>`;
  }
  function renderTeams(){
    const clubs=catalogTeamsAll();
    const pageSize=state.teamsPageSize;const pageCount=Math.max(1,Math.ceil(clubs.length/pageSize));state.teamsPage=Math.min(Math.max(1,state.teamsPage),pageCount);const start=(state.teamsPage-1)*pageSize;const visible=clubs.slice(start,start+pageSize);
    const cards=visible.map(team=>{const c=officialTeamCardName(team);const squad=playersForClubName(c,team);const ratings=squad.map(p=>p.overall).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);const avg=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):null;const memberships=team.leagues||[];const league=memberships[0]?.name||team.league||'Not assigned';const parent=memberships[0]?.name||team.league||'';
      return `<button class="section-card entity-card" data-team="${esc(c)}" ${parent?`data-parent-league="${esc(parent)}"`:''} ${team.teamId?`data-team-id="${esc(team.teamId)}"`:''}>${clubLogoForEntry(team,'lg')}<h3>${esc(c)}</h3><p>${esc(league)}</p><div class="entity-meta">${squad.length} player records${avg!==null?` · Avg ${avg} OVR`:''} · ${team.teamId?'PESMASTER ID '+esc(team.teamId):'unassigned local record'} ↗</div></button>`;
    }).join('');
    const pager=pageCount>1?`<div class="table-bottom entity-pager"><span>${state.lang==='ar'?`عرض الفرق ${start+1}–${Math.min(start+pageSize,clubs.length)} من ${clubs.length}`:`Showing ${start+1}–${Math.min(start+pageSize,clubs.length)} of ${clubs.length} teams`}</span><div class="pagination"><button class="page-btn" data-entity-page="prev" ${state.teamsPage===1?'disabled':''}>← Previous</button><span class="page-btn active">${state.teamsPage} / ${pageCount}</span><button class="page-btn" data-entity-page="next" ${state.teamsPage===pageCount?'disabled':''}>Next →</button></div></div>`:'';
    const verified=state.officialTeams.length>0;
    return `${heading('Teams',verified?'Teams, league memberships and badges are linked by PESMASTER PES 2021 team-page IDs.':'Official teams will appear here after the PESMASTER catalogue sync completes.',`<button class="btn btn-primary" data-route="search">⌕ Search players</button><button class="btn" data-action="refresh-team-catalog">↻ Sync PESMASTER teams</button>`)}${teamCatalogStatusMarkup()}<div class="entity-grid">${cards}</div>${pager}<div class="source-note">${verified?'Official PESMASTER team IDs define identity and logos. Similar names with different IDs stay separate; repeated copies with the same ID are merged. Local rosters show only records found in the active player database.':'The verified list is still loading. Only bundled verified records are shown; imported player clubs are not assigned to a league by guesswork.'}</div>`;
  }
  function renderLeagues(){
    const leagues=[...new Set((window.PITCHLAB_LEAGUE_CATALOG||[]).map(canonicalLeagueName))];
    const emptyIds=(state.officialCatalogStatus.emptyLeagueIds||[]).map(String);
    const syncing=['running','idle','unavailable'].includes(state.officialCatalogStatus.status);
    return `${heading('Leagues','Every league card uses the official PESMASTER PES 2021 league index. Team counts come from linked team pages, not from imported player names.',`<span class="pill pill-purple">${leagues.length} competitions</span><button class="btn" data-action="refresh-team-catalog">↻ Sync PESMASTER teams</button>`)}${teamCatalogStatusMarkup()}<div class="entity-grid">${leagues.map(l=>{
      const players=dataIndex.playersByLeague.get(l)||[];const official=officialTeamsForLeague(l);const localStatic=(window.PITCHLAB_STATIC_TEAMS_BY_LEAGUE||{})[l]||[];
      const ids=new Set(official.map(t=>String(t.teamId||'')).filter(Boolean));const teamKeys=new Set(official.filter(t=>!t.teamId).map(t=>assetKey(t.name)));
      const staticMissing=localStatic.filter(t=>t.teamId?!ids.has(String(t.teamId)):!teamKeys.has(assetKey(t.name)));
      const teamsCount=official.length+staticMissing.length;const leagueId=(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{})[l];
      const knownEmpty=state.officialCatalogStatus.status==='complete'&&leagueId!==undefined&&emptyIds.includes(String(leagueId));
      const countText=teamsCount?`${teamsCount} ${state.lang==='ar'?'فريق':'teams'}`:(knownEmpty?'0 '+(state.lang==='ar'?'فريق':'teams'):(syncing?(state.lang==='ar'?'قائمة الفرق بانتظار المزامنة':'team list pending sync'):(state.lang==='ar'?'قائمة الفرق غير متاحة':'team list unavailable')));
      const action=teamsCount||knownEmpty?'Open official team list ↗':'Sync official list ↗';
      return `<button class="section-card entity-card" data-league="${esc(l)}">${leagueLogo(l,'lg')}<h3>${esc(l)}</h3><p>${countText} · ${players.length} ${state.lang==='ar'?'سجل لاعب':'player records'}</p><div class="entity-meta">${action}</div></button>`;
    }).join('')}</div><div class="source-note">Only teams found on the league's PESMASTER page are assigned to that league. Imported player records alone are not used to guess team membership.</div>`;
  }
  function renderRosterRows(rows){
    return rows.map(p=>`<div class="squad-player-row">${avatar(p)}<div class="grow"><strong><button class="table-link" data-player="${esc(p.id)}">${esc(p.displayName)}</button></strong><small>${esc(p.position)} · ${esc(p.playingStyle||'—')} · ${state.lang==='ar'?'العمر':'Age'} ${fmt(p.age)}</small></div><span class="overall${overallClass(p.overall)}">${fmt(p.overall)}</span><button class="btn btn-icon btn-sm" data-action="select-for-compare" data-id="${esc(p.id)}" title="Add to comparison">⇄</button></div>`).join('')||`<div class="empty-state">${state.lang==='ar'?'مفيش لاعيبة مطابقة للفلاتر دي.':'No players match this filter.'}</div>`;
  }
  function localApiUpgradeMessage(){return state.lang==='ar'?'الخادم الحالي قديم أو شُغّل بدون Python. اقفل نوافذ PitchLab القديمة، ثم شغّل START-PITCHLAB.bat من النسخة الجديدة مع Python 3. لا تفتح index.html مباشرة.':'The current server is outdated or running without Python. Close old PitchLab windows, then run START-PITCHLAB.bat from the new folder with Python 3. Do not open index.html directly.';}
  function localApiJson(url){
    if(!state.localApiReady){state.localApiReady=fetch('/api/health',{cache:'no-store'}).then(async r=>{let health;try{health=JSON.parse(await r.text());}catch{throw new Error(localApiUpgradeMessage());}if(!r.ok||health.apiVersion!=='pitchlab-roster-profile-4')throw new Error(localApiUpgradeMessage());return true;}).catch(error=>{state.localApiReady=null;throw new Error(error.message===localApiUpgradeMessage()?error.message:localApiUpgradeMessage());});}
    return state.localApiReady.then(()=>fetch(url,{cache:'no-store'})).then(async response=>{let payload;try{payload=JSON.parse(await response.text());}catch{throw new Error(localApiUpgradeMessage());}if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);return payload;});
  }
  function requestOfficialTeamRoster(teamId,force=false){
    const id=String(teamId||'');if(!id||state.officialRosterLoading.has(id)||(!force&&state.officialRosters.has(id)))return;
    state.officialRosterLoading.add(id);state.officialRosterErrors.delete(id);
    localApiJson(`/api/team-roster/${encodeURIComponent(id)}`).then(payload=>{
      if(!Array.isArray(payload.players)||!payload.players.length)throw new Error('No PESMASTER players were returned');
      state.officialRosters.set(id,payload.players);state.officialRosterErrors.delete(id);
    }).catch(error=>state.officialRosterErrors.set(id,error.message||'Could not load PESMASTER squad')).finally(()=>{
      state.officialRosterLoading.delete(id);
      if((state.route.page==='team'&&String(state.route.params[2]||'')===id)||(state.route.page==='master-league'&&String(state.masterLeagueCampaign?.teamId||'')===id))render();
    });
  }
  function renderOfficialRosterRows(rows){
    return rows.map(p=>{const person={id:`pesmaster-${p.playerId}`,name:p.name,displayName:p.name,portraitUrl:p.portraitUrl,portraitFallbackUrl:p.portraitFallbackUrl,portraitSource:'pesmaster',pesmasterPlayerId:String(p.playerId)};const meta=[p.position,p.number?`#${p.number}`:'',p.age?`${state.lang==='ar'?'العمر':'Age'} ${p.age}`:''].filter(Boolean).join(' · ');return `<div class="squad-player-row">${avatar(person)}<div class="grow"><strong><button class="table-link" data-pesmaster-player="${esc(p.playerId)}" data-player-source="${esc(p.sourceUrl)}" data-parent-team="${esc(p.teamId)}">${esc(p.name)}</button></strong><small>${esc(meta)}${p.nationality?` · ${esc(p.nationality)}`:''}</small></div><span class="overall${overallClass(p.overall)}">${fmt(p.overall)}</span></div>`;}).join('')||`<div class="empty-state">${state.lang==='ar'?'مفيش لاعيبة مطابقة للفلاتر دي.':'No players match this filter.'}`;
  }
  function renderTeamLineup(team,roster){
    const teamKey=normalizeSlug(team?.name||''),teamId=String(team?.teamId||'');
    const allCoaches=coaches();
    const coach=(teamId?allCoaches.find(c=>(Array.isArray(c.teamLinks)&&c.teamLinks.some(link=>String(link.teamId||'')===teamId))||String(c.teamId||'')===teamId):null)||allCoaches.find(c=>(!Array.isArray(c.teamLinks)||!c.teamLinks.length)&&normalizeSlug(c.team||'')===teamKey&&Array.isArray(c.lineup)&&c.lineup.length);
    if(!coach&&!state.coachDataScriptLoaded&&!state.coachDataScriptFailed)return `<div class="section-card section-body team-lineup-unavailable">${state.lang==='ar'?'جارٍ تحميل الخطة الرسمية للفريق…':'Loading the official team formation…'}</div>`;
    if(!coach)return `<div class="section-card section-body team-lineup-unavailable">${state.lang==='ar'?'لا توجد خطة رسمية مرتبطة بهذا الفريق في المصدر.':'No official team formation is linked to this team in the source.'}</div>`;
    const used=new Set(),rows=[...(coach.lineup||[])].reverse();
    const positionFamily={GK:'GK',CB:'DEF',LB:'DEF',RB:'DEF',DMF:'MID',CMF:'MID',AMF:'MID',LMF:'WIDE',RMF:'WIDE',LWF:'WIDE',RWF:'WIDE',SS:'FWD',CF:'FWD'};
    const renderedRows=rows.map(row=>`<div>${row.map(position=>{
      const available=roster.filter(p=>!used.has(String(p.playerId))).sort((a,b)=>(Number(b.overall)||0)-(Number(a.overall)||0));
      const choices=available.filter(p=>p.position===position);
      const family=positionFamily[position];const familyChoices=family?available.filter(p=>positionFamily[p.position]===family):[];
      const player=choices[0]||familyChoices[0]||available[0];if(player)used.add(String(player.playerId));
      if(!player)return `<div class="team-pitch-player empty"><span class="team-pitch-avatar">${esc(position)}</span><small>${esc(position)}</small></div>`;
      const person={id:`pesmaster-${player.playerId}`,name:player.name,displayName:player.name,portraitUrl:player.portraitUrl,portraitFallbackUrl:player.portraitFallbackUrl,portraitSource:'pesmaster',pesmasterPlayerId:String(player.playerId)};
      return `<button class="team-pitch-player" data-pesmaster-player="${esc(player.playerId)}" data-player-source="${esc(player.sourceUrl)}" data-parent-team="${esc(player.teamId)}" title="${esc(player.name)} — ${esc(position)}"><span class="team-pitch-photo">${avatar(person)}</span><strong>${esc(player.name)}</strong><small>${esc(position)}${player.position!==position?` · ${esc(player.position)}`:''}${player.overall!==null&&player.overall!==undefined?` · ${esc(player.overall)}`:''}</small></button>`;
    }).join('')}</div>`).join('');
    return `<div class="section-card team-lineup-card"><div class="section-head"><div><h2>${state.lang==='ar'?'خطة الفريق':'Team formation'}</h2><p>${state.lang==='ar'?'صور اللاعبين وتوزيعهم حسب الخطة الرسمية للفريق':'Team players placed by position in the official formation'}</p></div><span class="pill pill-purple">${esc(coach.formation)}</span></div><div class="team-lineup-pitch"><div class="team-lineup-marking"></div><div class="team-lineup-rows">${renderedRows}</div></div></div>`;
  }
  function requestOfficialPlayerProfile(id,source,force=false){
    const pid=String(id||'');if(!pid||state.officialPlayerLoading.has(pid)||(!force&&state.officialPlayerProfiles.has(pid)))return;
    state.officialPlayerLoading.add(pid);state.officialPlayerErrors.delete(pid);
    localApiJson(`/api/player-profile/${encodeURIComponent(pid)}?source=${encodeURIComponent(source||'')}`).then(profile=>{state.officialPlayerProfiles.set(pid,profile);state.officialPlayerErrors.delete(pid);}).catch(error=>state.officialPlayerErrors.set(pid,error.message||'Could not load player profile')).finally(()=>{state.officialPlayerLoading.delete(pid);if(state.route.page==='pesmaster-player'&&String(state.route.params[0]||'')===pid)render();});
  }
  function renderOfficialPlayerProfile(id,source,teamId){
    const pid=String(id||''),profile=state.officialPlayerProfiles.get(pid),team=state.officialTeamsById.get(String(teamId||''));
    const back=team?`<button class="btn" data-route="team/${encodeURIComponent(team.name)}/${encodeURIComponent((team.leagues||[])[0]?.name||'')}/${encodeURIComponent(team.teamId)}">← ${state.lang==='ar'?'العودة للفريق':'Back to team'}</button>`:`<button class="btn" data-route="teams">← ${state.lang==='ar'?'كل الفرق':'All teams'}</button>`;
    if(!profile){if(!state.officialPlayerErrors.has(pid))requestOfficialPlayerProfile(pid,source);const error=state.officialPlayerErrors.get(pid);return `${heading(state.lang==='ar'?'ملف اللاعب':'Player profile',state.lang==='ar'?'تحميل بيانات اللاعب وصورته الرسمية داخل الموقع':'Loading official player data and portrait inside this site',back)}<div class="section-card section-body"><p>${error?esc(error):(state.lang==='ar'?'جارٍ تحميل الملف...':'Loading player profile...')}</p>${error?`<button class="btn btn-primary" data-action="retry-player-profile" data-id="${esc(pid)}" data-source="${esc(source)}">${state.lang==='ar'?'إعادة المحاولة':'Try again'}</button>`:''}</div>`;}
    const groups=ATTRS.map(([title,items])=>`<div class="attribute-group"><h3>${esc(title)}</h3>${items.map(([key,label])=>{const value=profile.attributes?.[key];return `<div class="attr-row"><span class="attr-label">${esc(label)}</span><span class="attr-bar"><span class="attr-fill" style="display:block;width:${Math.min(100,Math.max(0,Number(value)||0))}%"></span></span><strong class="attr-value">${fmt(value)}</strong></div>`;}).join('')}</div>`).join('');
    const catalogPlayer=dataIndex.playerByPesmasterId.get(pid);
    const person={id:`pesmaster-${pid}`,name:profile.displayName||profile.name,displayName:profile.displayName||profile.name,portraitId:catalogPlayer?.portraitId||pid,portraitUrl:profile.portraitUrl||catalogPlayer?.portraitUrl||'',portraitFallbackUrl:profile.portraitFallbackUrl||catalogPlayer?.portraitFallbackUrl||'',portraitSource:'pesmaster',pesmasterPlayerId:pid};
    return `${heading(state.lang==='ar'?'ملف اللاعب':'Player profile',`${esc(profile.name)} · ${state.lang==='ar'?'بيانات PESMASTER PES 2021':'PESMASTER PES 2021 player data'}`,back)}<div class="profile-hero"><div class="profile-avatar-wrap">${avatar(person,true)}</div><div class="profile-identity"><h1>${esc(profile.name)}</h1><div class="profile-tags"><span class="position-tag">${esc(profile.position||'—')}</span><span>${esc(profile.club||'—')}</span><span>${esc(profile.league||'—')}</span><span>${esc(profile.nationality||'—')}</span></div><div class="profile-tags" style="margin-top:8px"><span>${esc(profile.playingStyle||'—')}</span><span>${esc(profile.foot||'—')} foot</span><span class="pill pill-green">PESMASTER PES 2021</span></div></div><div class="profile-rating"><strong>${fmt(profile.overall)}</strong><span>Overall</span></div></div><div class="profile-info-grid"><div class="info-tile"><span>Age</span><strong>${fmt(profile.age)} years</strong></div><div class="info-tile"><span>Height / Weight</span><strong>${fmt(profile.height,' cm')} / ${fmt(profile.weight,' kg')}</strong></div><div class="info-tile"><span>Stronger foot</span><strong>${esc(profile.foot||'—')}</strong></div><div class="info-tile"><span>Player ID</span><strong>${esc(pid)}</strong></div>${profile.marketValue?`<div class="info-tile"><span>Market value</span><strong>${esc(profile.marketValue)}</strong></div>`:''}${profile.contractDuration?`<div class="info-tile"><span>Contract duration</span><strong>${esc(profile.contractDuration)}</strong></div>`:''}${profile.condition?`<div class="info-tile"><span>Condition</span><strong>${esc(profile.condition)}</strong></div>`:''}${profile.playerType?`<div class="info-tile"><span>Player type</span><strong>${esc(profile.playerType)}</strong></div>`:''}${profile.faceAvailable?`<div class="info-tile"><span>Face</span><strong>${esc(profile.faceAvailable)}</strong></div>`:''}${profile.myClubAvailable?`<div class="info-tile"><span>MyClub</span><strong>${esc(profile.myClubAvailable)}</strong></div>`:''}</div><div class="profile-layout"><div class="section-card"><div class="section-head"><div><h2>${state.lang==='ar'?'تقييمات المهارات':'Player attributes'}</h2><p>${state.lang==='ar'?'القيم المتاحة من ملف PESMASTER الرسمي':'Values from the official PESMASTER profile'}</p></div></div><div class="section-body"><div class="attribute-groups">${groups}</div></div></div><div style="display:grid;gap:16px"><div class="section-card"><div class="section-head"><h2>${state.lang==='ar'?'المراكز':'Positions'}</h2></div><div class="section-body"><div class="tag-list">${Object.entries(profile.positionRatings||{}).map(([pos,rating])=>`<span class="secondary-position">${esc(pos)} ${esc(rating)}</span>`).join('')||`<span class="secondary-position">${esc(profile.position||'—')}</span>`}</div></div></div><div class="section-card"><div class="section-head"><h2>${state.lang==='ar'?'المهارات':'Player skills'}</h2></div><div class="section-body"><div class="tag-list">${(profile.skills||[]).map(skill=>`<span class="skill-tag">${esc(skill)}</span>`).join('')||'—'}</div></div></div><div class="section-card"><div class="section-head"><h2>COM playing styles</h2></div><div class="section-body"><div class="tag-list">${(profile.comPlayingStyles||[]).map(style=>`<span class="skill-tag style-tag">${esc(style)}</span>`).join('')||'—'}</div></div></div></div></div>`;
  }
  function renderOfficialTeamDetail(team,league,roster){
    const name=team?.name||'Team',source=team?.sourceUrl||'',teamId=String(team?.teamId||''),back=`<button class="btn" data-route="league/${encodeURIComponent(league)}">← ${state.lang==='ar'?'العودة للدوري':'Back to league'}</button>`;
    if(!roster){const error=state.officialRosterErrors.get(teamId);return `${heading(`<span class="club-title">${clubLogoForEntry(team,'md')}<span>${esc(name)}</span></span>`,`${esc(league)} · ${state.lang==='ar'?'قائمة PESMASTER الرسمية لموسم 2021':'Official PESMASTER PES 2021 squad'}`,`${back}${source?`<a class="btn" href="${esc(source)}" target="_blank" rel="noopener noreferrer">PESMASTER ↗</a>`:''}`)}<div class="section-card team-detail-summary"><div class="team-detail-crest">${clubLogoForEntry(team,'xl')}</div><div class="grow"><h2>${esc(name)}</h2><p>${state.lang==='ar'?'الدوري':'League'}: ${esc(league)}</p><span class="pill ${error?'pill-amber':'pill-purple'}">${error?(state.lang==='ar'?'تعذر تحميل القائمة':'Could not load squad'):(state.lang==='ar'?'جارٍ تحميل القائمة الرسمية':'Loading official squad')}</span><p>${error?esc(error):(state.lang==='ar'?'جارٍ جلب اللاعبين وصورهم مباشرة من صفحة الفريق الرسمية.':'Loading players and portraits from the official team page.')}</p>${error?`<button class="btn btn-primary" data-action="retry-team-roster" data-id="${esc(teamId)}">${state.lang==='ar'?'إعادة المحاولة':'Try again'}</button>`:''}</div></div>`;}
    const filtered=roster.filter(p=>(state.teamPosition==='ALL'||p.position===state.teamPosition)&&(!state.teamQuery||p.name.toLowerCase().includes(state.teamQuery.toLowerCase())));const pageCount=Math.max(1,Math.ceil(filtered.length/state.rosterPageSize));state.rosterPage=Math.min(Math.max(1,state.rosterPage),pageCount);const start=(state.rosterPage-1)*state.rosterPageSize;const visible=filtered.slice(start,start+state.rosterPageSize);const pager=pageCount>1?`<div class="table-bottom entity-pager"><span>${state.lang==='ar'?`عرض اللاعبين ${start+1}–${Math.min(start+state.rosterPageSize,filtered.length)} من ${filtered.length}`:`Showing players ${start+1}–${Math.min(start+state.rosterPageSize,filtered.length)} of ${filtered.length}`}</span><div class="pagination"><button class="page-btn" data-roster-page="prev" ${state.rosterPage===1?'disabled':''}>← Previous</button><span class="page-btn active">${state.rosterPage} / ${pageCount}</span><button class="page-btn" data-roster-page="next" ${state.rosterPage===pageCount?'disabled':''}>Next →</button></div></div>`:'';
    return `${heading(`<span class="club-title">${clubLogoForEntry(team,'md')}<span>${esc(name)}</span></span>`,`${esc(league)} · ${roster.length} ${state.lang==='ar'?'لاعب من قائمة PESMASTER الرسمية':'official PESMASTER players'}`,`${back}${source?`<a class="btn" href="${esc(source)}" target="_blank" rel="noopener noreferrer">PESMASTER ↗</a>`:''}`)}<div class="section-card team-detail-summary"><div class="team-detail-crest">${clubLogoForEntry(team,'xl')}</div><div class="grow"><h2>${esc(name)}</h2><p>${state.lang==='ar'?'الدوري':'League'}: ${esc(league)}</p><span class="pill pill-purple">${roster.length} ${state.lang==='ar'?'لاعب':'players'}</span></div></div>${renderTeamLineup(team,roster)}<div class="section-card"><div class="section-head"><div><h2>${state.lang==='ar'?'لاعبو الفريق':'Squad list'}</h2><p>${filtered.length} ${state.lang==='ar'?'لاعب ظاهر':'players shown'}</p></div><div class="squad-filters">${['ALL','GK','CB','LB','RB','DMF','CMF','AMF','LMF','RMF','LWF','RWF','SS','CF'].map(pos=>`<button data-roster-position="${pos}" class="${state.teamPosition===pos?'active':''}">${pos==='ALL'?(state.lang==='ar'?'كل المراكز':'All positions'):pos}</button>`).join('')}</div></div><div class="section-body" style="padding-bottom:4px"><div class="field" style="max-width:360px"><input id="team-roster-search" value="${esc(state.teamQuery)}" placeholder="${state.lang==='ar'?'ابحث في لاعيبة الفريق…':'Search this squad…'}" aria-label="${state.lang==='ar'?'ابحث في لاعيبة الفريق':'Search squad'}"></div></div><div class="squad-list" id="team-roster-list">${renderOfficialRosterRows(visible)}</div>${pager}</div><div class="source-note">${state.lang==='ar'?'الأسماء والمراكز والتقييمات والصور مرتبطة بصفحة الفريق الرسمية في PESMASTER PES 2021.':'Names, positions, ratings and portraits are linked to the official PESMASTER PES 2021 team page.'}</div>`;
  }
  function renderRosterPager(total){
    const size=state.rosterPageSize,pageCount=Math.max(1,Math.ceil(total/size));state.rosterPage=Math.min(Math.max(1,state.rosterPage),pageCount);
    if(pageCount<=1)return '';
    const start=(state.rosterPage-1)*size;
    return `<div class="table-bottom entity-pager"><span>${state.lang==='ar'?`عرض اللاعبين ${start+1}–${Math.min(start+size,total)} من ${total}`:`Showing players ${start+1}–${Math.min(start+size,total)} of ${total}`}</span><div class="pagination"><button class="page-btn" data-roster-page="prev" ${state.rosterPage===1?'disabled':''}>← Previous</button><span class="page-btn active">${state.rosterPage} / ${pageCount}</span><button class="page-btn" data-roster-page="next" ${state.rosterPage===pageCount?'disabled':''}>Next →</button></div></div>`;
  }
  function renderTeamDetail(name,kind){
    if(kind==='league'){
      name=canonicalLeagueName(name);
      const leaguePlayers=dataIndex.playersByLeague.get(name)||[];
      const catalogTeams=officialTeamsForLeague(name);
      const localStatic=(window.PITCHLAB_STATIC_TEAMS_BY_LEAGUE||{})[name]||[];
      const clubItems=[],seenIds=new Set(),seenNamesWithoutId=new Set();
      const addTeam=(team)=>{
        if(!team)return;const id=String(team.teamId||'').trim();const key=assetKey(team.name||team.sourceName||team.slug);
        if(id){if(seenIds.has(id))return;seenIds.add(id);}else{if(!key||seenNamesWithoutId.has(key))return;seenNamesWithoutId.add(key);}
        clubItems.push(team);
      };
      catalogTeams.forEach(addTeam);
      for(const entry of localStatic){if(entry.teamId&&seenIds.has(String(entry.teamId)))continue;addTeam({...entry,league:name,leagues:[{name,leagueId:(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{})[name]}]});}
      const clubPageSize=48;const clubPageCount=Math.max(1,Math.ceil(clubItems.length/clubPageSize));state.leagueTeamsPage=Math.min(Math.max(1,state.leagueTeamsPage),clubPageCount);const clubStart=(state.leagueTeamsPage-1)*clubPageSize;const visibleClubItems=clubItems.slice(clubStart,clubStart+clubPageSize);
      if(!clubItems.length){const source=leagueSourceUrl(name);const leagueId=(window.PITCHLAB_LEAGUE_PESMASTER_IDS||{})[name];const knownEmpty=state.officialCatalogStatus.status==='complete'&&leagueId!==undefined&&(state.officialCatalogStatus.emptyLeagueIds||[]).map(String).includes(String(leagueId));const description=knownEmpty?(state.lang==='ar'?'صفحة PESMASTER الرسمية لهذا الدوري لا تعرض فرقًا.':'The official PESMASTER page currently publishes no teams for this competition.'):(state.lang==='ar'?'قائمة الفرق لم تتم مزامنتها بعد.':'The official team list has not synced yet.');const message=knownEmpty?(state.lang==='ar'?'عدد الفرق في المصدر الرسمي: 0.':'Official team count: 0.'):(state.lang==='ar'?'حدّث الفهرس؛ لن نخمن انتماء الفرق من أسماء اللاعبين.':'Refresh the catalogue; team membership is never guessed from player names.');return `${heading(`<span class="league-title">${leagueLogo(name,'md')}<span>${esc(name)}</span></span>`,`${esc(name)} · ${description}`,`<button class="btn" data-route="leagues">← ${tr('Back to leagues')}</button>${source?`<a class="btn btn-primary" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Open PESMASTER ↗</a>`:''}${knownEmpty?'':`<button class="btn" data-action="refresh-team-catalog">↻ Sync teams</button>`}`)}${teamCatalogStatusMarkup()}<div class="section-card section-body"><p>${message}</p></div>`;}
      const clubCards=visibleClubItems.map(team=>{const club=officialTeamCardName(team);const squad=playersForClubName(club,team);const ratings=squad.map(p=>p.overall).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);const avg=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):null;const source=team.sourceUrl||teamSourceUrl(club);
        return `<button class="section-card entity-card league-club-card" data-team="${esc(club)}" data-parent-league="${esc(name)}" ${team.teamId?`data-team-id="${esc(team.teamId)}"`:''}>${clubLogoForEntry(team,'lg')}<h3>${esc(club)}</h3><p>${esc(name)}</p><div class="league-club-stats"><span>${squad.length} ${state.lang==='ar'?'سجل لاعب محلي':'local player records'}</span>${avg!==null?`<span>${state.lang==='ar'?'متوسط التقييم':'Avg OVR'} ${avg}</span>`:''}</div><div class="entity-meta">${team.teamId?`PESMASTER ID ${esc(team.teamId)} · `:''}${source?'Official badge linked':'Badge unavailable'} ↗</div></button>`;
      }).join('');
      const leaguePager=clubPageCount>1?`<div class="table-bottom entity-pager"><span>${state.lang==='ar'?`عرض الفرق ${clubStart+1}–${Math.min(clubStart+clubPageSize,clubItems.length)} من ${clubItems.length}`:`Showing ${clubStart+1}–${Math.min(clubStart+clubPageSize,clubItems.length)} of ${clubItems.length} clubs`}</span><div class="pagination"><button class="page-btn" data-league-club-page="prev" ${state.leagueTeamsPage===1?'disabled':''}>← Previous</button><span class="page-btn active">${state.leagueTeamsPage} / ${clubPageCount}</span><button class="page-btn" data-league-club-page="next" ${state.leagueTeamsPage===clubPageCount?'disabled':''}>Next →</button></div></div>`:'';
      const source=leagueSourceUrl(name);const status=state.officialCatalogStatus;const rosterStatus=state.lang==='ar'?`فهرس الفرق الرسمي: ${clubItems.length} فريقًا؛ سجلات اللاعبين المحلية في الدوري: ${leaguePlayers.length}.`:`Official team index: ${clubItems.length} teams; local player records labelled with this competition: ${leaguePlayers.length}.`;
      return `${heading(`<span class="league-title">${leagueLogo(name,'md')}<span>${esc(name)}</span></span>`,state.lang==='ar'?`فرق المصدر الرسمي وسجلات اللاعبين المتاحة · ${clubItems.length} فرق`:`Official PESMASTER teams and local player records · ${clubItems.length} teams`,`<button class="btn" data-route="leagues">← ${state.lang==='ar'?'كل الدوريات':'All leagues'}</button>${source?`<a class="btn btn-primary" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Open PESMASTER ↗</a>`:''}<button class="btn" data-action="refresh-team-catalog">↻ Sync teams</button>`)}${teamCatalogStatusMarkup()}<div class="section-card league-clubs-intro"><div class="intro-symbol">⚽</div><div><strong>${state.lang==='ar'?'اختار فريق علشان تشوف بياناته':'Choose a team to view details'}</strong><p>${state.lang==='ar'?'كل فريق هنا مرتبط بالدوري من صفحة المسابقة الرسمية. اللاعبين يظهرون فقط لو قاعدة اللاعبين المحلية تحتويهم.':'Every team here is assigned from its official competition page. Player rows appear only when your local database contains them.'}</p></div><span class="pill pill-purple">${clubItems.length} ${state.lang==='ar'?'فرق':'teams'}</span></div><div class="entity-grid league-club-grid">${clubCards}</div>${leaguePager}<div class="source-note">${esc(rosterStatus)} ${status?.status==='partial'?'Some competition pages could not be read; use the refresh button to retry unavailable pages.':''}</div>`;
    }

    const routeTeamId=String(state.route.params[2]||'');
    const official=(routeTeamId&&state.officialTeamsById.get(routeTeamId))||officialTeamForName(name)||staticTeamEntry(name);
    const officialTeamId=String(official?.teamId||routeTeamId||'');
    if(officialTeamId){const exactRoster=state.officialRosters.get(officialTeamId);const league=state.route.params[1]||(official?.leagues||[])[0]?.name||official?.league||'—';if(!exactRoster&&!state.officialRosterErrors.has(officialTeamId))requestOfficialTeamRoster(officialTeamId);return renderOfficialTeamDetail(official,league,exactRoster||null);}
    const entityPlayers=playersForClubName(name,official);
    if(!entityPlayers.length){if(!official)return `${heading('No records found',`No player records were found for ${esc(name)}.`,`<button class="btn" data-route="teams">← ${state.lang==='ar'?'العودة للأندية':'Back to teams'}</button>`)}`;const league=(official.leagues||[])[0]?.name||official.league||'—';const source=official.sourceUrl||teamSourceUrl(name)||'';return `${heading(`<span class="club-title">${clubLogoForEntry(official,'md')}<span>${esc(official.name||name)}</span></span>`,`${esc(league)} · Verified PESMASTER PES 2021 team; player records may not be imported locally.`,`<button class="btn" data-route="league/${encodeURIComponent(league)}">← ${esc(league)}</button><a class="btn btn-primary" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Open PESMASTER team ↗</a>`)}<div class="section-card team-detail-summary"><div class="team-detail-crest">${clubLogoForEntry(official,'xl')}</div><div class="grow"><h2>${esc(official.name||name)}</h2><p>${esc(league)}</p><span class="pill pill-amber">Roster not imported</span><p>${official.teamId?`PESMASTER team ID ${esc(official.teamId)}`:''}</p></div></div><div class="source-note">The official team and badge are shown from PESMASTER profile information. No player records or ratings were fabricated.</div>`;}
    const parentLeague=state.route.params[1]||entityPlayers[0]?.league||(official?.leagues||[])[0]?.name||official?.league||'';
    const teamName=official?.name||name;
    const filtered=entityPlayers.filter(p=>(state.teamPosition==='ALL'||p.position===state.teamPosition||(p.secondaryPositions||[]).includes(state.teamPosition))&&(!state.teamQuery||p.displayName.toLowerCase().includes(state.teamQuery.toLowerCase())));
    const rosterPages=Math.max(1,Math.ceil(filtered.length/state.rosterPageSize));state.rosterPage=Math.min(Math.max(1,state.rosterPage),rosterPages);const rosterStart=(state.rosterPage-1)*state.rosterPageSize;const visibleRoster=filtered.slice(rosterStart,rosterStart+state.rosterPageSize);
    const backAction=state.route.params[1]?`<button class="btn" data-route="league/${encodeURIComponent(parentLeague)}">← ${state.lang==='ar'?'العودة للدوري':'Back to league'}</button>`:`<button class="btn" data-route="teams">← ${state.lang==='ar'?'كل الأندية':'All teams'}</button>`;const source=official?.sourceUrl||teamSourceUrl(name);
    return `${heading(`<span class="club-title">${clubLogoForEntry(official||staticTeamEntry(teamName),'md')}<span>${esc(teamName)}</span></span>`,`${state.lang==='ar'?'قائمة لاعبي الفريق':'Club squad'} · ${entityPlayers.length} ${state.lang==='ar'?'سجل لاعب في قاعدة البيانات الحالية':'player records in the active dataset'}`,`${backAction}<button class="btn btn-primary" data-route="search">⌕ ${state.lang==='ar'?'بحث اللاعبين':'Search players'}</button>${source?`<a class="btn" href="${esc(source)}" target="_blank" rel="noopener noreferrer">PESMASTER ↗</a>`:''}`)}<div class="section-card team-detail-summary"><div class="team-detail-crest">${clubLogoForEntry(official||staticTeamEntry(teamName),'xl')}</div><div class="grow"><h2>${esc(teamName)}</h2><p>${state.lang==='ar'?'الدوري':'League'}: <button class="table-link" data-route="league/${encodeURIComponent(parentLeague)}">${esc(parentLeague)}</button></p><span class="pill pill-purple">${entityPlayers.length} ${state.lang==='ar'?'لاعب متاح':'available players'}</span></div></div><div class="section-card"><div class="section-head"><div><h2>${state.lang==='ar'?'لاعبو الفريق':'Squad list'}</h2><p>${filtered.length} ${state.lang==='ar'?'لاعب ظاهر':'players shown'}</p></div><div class="squad-filters">${['ALL','GK','CB','LB','RB','DMF','CMF','AMF','LWF','RWF','SS','CF'].map(pos=>`<button data-roster-position="${pos}" class="${state.teamPosition===pos?'active':''}">${pos==='ALL'?(state.lang==='ar'?'كل المراكز':'All positions'):pos}</button>`).join('')}</div></div><div class="section-body" style="padding-bottom:4px"><div class="field" style="max-width:360px"><input id="team-roster-search" value="${esc(state.teamQuery)}" placeholder="${state.lang==='ar'?'ابحث في لاعيبة الفريق…':'Search this squad…'}" aria-label="${state.lang==='ar'?'ابحث في لاعيبة الفريق':'Search squad'}"></div></div><div class="squad-list" id="team-roster-list">${renderRosterRows(visibleRoster)}</div>${renderRosterPager(filtered.length)}</div><div class="source-note">${state.lang==='ar'?'الضغط على اسم أي لاعب يفتح ملفه الشخصي بكل الإحصائيات المتاحة.':'Click any player name to open the full player profile.'}</div>`;
  }
  function squadAssignments(){return FORMATIONS[state.formation]||FORMATIONS['4-3-3'];}
  function assignedIds(){return new Set(Object.values(state.squad).filter(Boolean).map(String));}
  function squadAverageOverall(players){const ratings=players.map(p=>p?.overall).filter(value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))).map(Number);return ratings.length?Math.round(ratings.reduce((sum,value)=>sum+value,0)/ratings.length):'—';}
  function renderSquad(){const slots=squadAssignments();const players=slots.map((s,i)=>byId(state.squad[i])).filter(Boolean);const avg=squadAverageOverall(players);
    const pitch=`<div class="pitch"> <div class="halfway"></div><div class="centre-circle"></div><div class="box top"></div><div class="box bottom"></div>${slots.map((s,i)=>{const p=byId(state.squad[i]);return `<button class="pitch-slot ${p?'':'empty'} ${state.activeSlot===i?'active':''}" style="left:${s[1]}%;top:${s[2]}%" data-slot="${i}" title="${p?`${p.displayName} — click to replace`: 'Add '+s[0]}"><span class="slot-position">${s[0]}</span><div class="slot-photo">${p?avatar(p,false,'pitch-player-avatar'):'+'}</div><span class="slot-name">${p?esc(p.displayName):'+ Add player'}</span>${p?`<span class="slot-rating">${fmt(p.overall)}</span>`:''}</button>`}).join('')}</div>`;
    return `${heading('Squad Builder','Choose a formation, assign players to pitch positions, and save your lineup locally.',`<button class="btn" data-route="search">Find players</button><button class="btn btn-primary" data-action="save-squad">▣ ${tr('Save Squad')}</button>`)}<div class="builder-layout"><div class="section-card"><div class="section-head"><div><h2>Formation board</h2><p>Click a position tile to add, replace, or remove a player.</p></div><span class="pill pill-purple">${state.formation}</span></div><div class="section-body"><div class="field" style="max-width:240px;margin-bottom:13px"><label>${tr('Formation')}</label><select id="formation-select" class="control">${Object.keys(FORMATIONS).map(f=>`<option ${state.formation===f?'selected':''}>${f}</option>`).join('')}</select></div><div class="pitch-wrap">${pitch}</div></div></div><aside class="builder-controls"><div class="section-card"><div class="section-head"><h2>Squad overview</h2><span class="pill pill-green">${players.length}/11 selected</span></div><div class="section-body"><div class="builder-stats"><div class="builder-stat"><span>Average overall</span><strong>${avg}</strong></div><div class="builder-stat"><span>Filled positions</span><strong>${players.length}/11</strong></div></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:13px"><button class="btn btn-primary" data-action="save-squad">▣ ${tr('Save Squad')}</button><button class="btn" data-action="load-squad">↻ ${tr('Load Squad')}</button><button class="btn btn-danger" data-action="clear-squad">Clear</button></div><p class="builder-note" style="margin-bottom:0">Squad data is stored in this browser only. Ratings and player options come from the active dataset.</p></div></div><div class="section-card"><div class="section-head"><h2>Assigned players</h2></div><div class="section-body" style="padding:11px"><div style="display:grid;gap:7px">${slots.map((s,i)=>{const p=byId(state.squad[i]);return `<div class="squad-player-row" style="padding:7px">${p?avatar(p):`<div class="player-avatar" style="background:#f2f0f8;color:#8b86a2">+</div>`}<div class="grow"><strong>${p?esc(p.displayName):`Empty ${s[0]} slot`}</strong><small>${s[0]} · ${p?`OVR ${fmt(p.overall)}`:'No player assigned'}</small></div><button class="btn btn-sm btn-icon" data-slot="${i}" title="Assign or replace">${p?'↻':'+'}</button></div>`}).join('')}</div></div></div></aside></div>`;
  }
  function pickerModal(){return `<div class="picker-modal ${state.pickerOpen?'open':''}" id="picker-modal" role="dialog" aria-modal="true" aria-labelledby="picker-title"><div class="picker-dialog"><div class="picker-head"><h3 id="picker-title">Select player for position</h3><button class="btn btn-icon" data-action="close-picker" aria-label="Close player picker">×</button></div><div class="picker-search"><input id="picker-search" value="${esc(state.pickerSearch)}" placeholder="Search players by name, team or position…"></div><div class="picker-list" id="picker-list">${state.pickerOpen?renderPickerOptions():''}</div><div style="padding:11px 14px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:space-between"><button class="btn btn-danger btn-sm" data-action="clear-active-slot">Remove player from position</button><button class="btn btn-sm" data-action="close-picker">Cancel</button></div></div></div>`;}
  function renderPickerOptions(){
    if(state.route.page==='squad'&&state.players.length<1000){
      if(state.fullDatabaseStatus==='failed')return `<div class="empty-state">${state.lang==='ar'?'فشل تحميل قاعدة اللاعبين الكاملة.':'The full player catalogue could not be loaded.'}<br><button class="btn btn-primary" data-action="load-pesmaster-catalog">${state.lang==='ar'?'إعادة المحاولة':'Retry catalogue load'}</button></div>`;
      return `<div class="empty-state" role="status">${state.lang==='ar'?'جارٍ تحميل لاعبي PES 2021 قبل فتح الاختيارات…':'Loading the complete PES 2021 player catalogue before showing choices…'}</div>`;
    }
    const used=assignedIds(),q=(state.pickerSearch||'').trim().toLowerCase();
    const matches=state.players.filter(p=>{const s=[p.displayName,p.name,p.club,p.position,p.nationality].join(' ').toLowerCase();return (!q||s.includes(q))&&(!used.has(String(p.id))||String(state.squad[state.activeSlot])===String(p.id));});
    const total=matches.length,pageSize=100,pageCount=Math.max(1,Math.ceil(total/pageSize));state.pickerPage=Math.min(Math.max(0,state.pickerPage),pageCount-1);const start=state.pickerPage*pageSize,visible=matches.slice(start,start+pageSize);
    const count=state.lang==='ar'?`عرض ${total?start+1:0}–${Math.min(start+pageSize,total)} من ${total.toLocaleString()} لاعب متاح — البحث يشمل القائمة كلها`:`Showing ${total?start+1:0}–${Math.min(start+pageSize,total)} of ${total.toLocaleString()} available players · search covers the full list`;
    const options=visible.map(p=>`<button class="picker-option" data-assign-player="${esc(p.id)}">${avatar(p)}<span class="picker-option-info"><strong>${esc(p.displayName)}</strong><small>${clubLogo(p.club,'xs')} ${esc(p.club)} · ${esc(p.position)} · Age ${fmt(p.age)}</small></span><span class="overall${overallClass(p.overall)}">${fmt(p.overall)}</span></button>`).join('');
    const pages=pageCount>1?`<div class="picker-page-controls"><button class="btn btn-sm" data-action="picker-page-prev" ${state.pickerPage===0?'disabled':''}>${state.lang==='ar'?'السابق':'Previous'}</button><span>${state.pickerPage+1} / ${pageCount}</span><button class="btn btn-sm" data-action="picker-page-next" ${state.pickerPage===pageCount-1?'disabled':''}>${state.lang==='ar'?'التالي':'Next'}</button></div>`:'';
    return `<div class="picker-result-count" role="status">${count}</div>${options||`<div class="empty-state">${state.lang==='ar'?'لا يوجد لاعب متاح يطابق البحث.':'No available players match your search.'}</div>`}${pages}`;
  }
  function normalizeSlug(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
  function parseDelimitedRow(line){
    const out=[];let cell='',quote=null;
    for(let i=0;i<line.length;i++){
      const c=line[i],n=line[i+1];
      if(quote){
        if(c===quote&&n===quote){cell+=quote;i++;}
        else if(c===quote)quote=null;
        else if(c==='\\'&&n===quote){cell+=n;i++;}
        else cell+=c;
      }else if((c==='"'||c==="'")&&cell.trim()===''){
        quote=c;
      }else if(c===','){
        out.push(cell.trim());cell='';
      }else cell+=c;
    }
    out.push(cell.trim());
    return out.map(v=>v==='?'?'':v);
  }
  async function parseArff(text){
    // Scan one line at a time: split() creates a second enormous array for large ARFF files.
    const attrs=[],rows=[];let inData=false,lineIndex=0,cursor=0;const source=String(text||'').replace(/^\uFEFF/,'');
    const unquote=v=>String(v??'').trim().replace(/^['"]|['"]$/g,'').replace(/\\(['"])/g,'$1');
    while(cursor<=source.length){
      let end=source.indexOf('\n',cursor);if(end<0)end=source.length;
      const rawLine=source.slice(cursor,end).replace(/\r$/,'');cursor=end===source.length?source.length+1:end+1;lineIndex++;
      const line=rawLine.trim();
      if(line&&!line.startsWith('%')){
        if(!inData){
          if(/^@attribute\b/i.test(line)){
            const rest=line.replace(/^@attribute\s+/i,'');let name='';
            if(rest[0]==='"'||rest[0]==="'"){
              const q=rest[0];let finish=1;for(;finish<rest.length;finish++){if(rest[finish]===q&&rest[finish-1]!=='\\')break;}
              name=rest.slice(1,finish);
            }else{const match=rest.match(/^(\S+)/);if(match)name=match[1];}
            if(name)attrs.push(name);
          }else if(/^@data\b/i.test(line))inData=true;
        }else if(line.startsWith('{')&&line.endsWith('}')){
          const sparse={};
          for(const part of parseDelimitedRow(line.slice(1,-1))){const match=part.trim().match(/^(\d+)\s+([\s\S]*)$/);if(match)sparse[Number(match[1])]=unquote(match[2]);}
          rows.push(Object.fromEntries(attrs.map((a,i)=>[a,(sparse[i]??'')==='?'?'':(sparse[i]??'')])));
        }else{
          const vals=parseDelimitedRow(line);
          if(vals.length>=Math.min(attrs.length,2)){const row={};attrs.forEach((a,i)=>row[a]=vals[i]??'');rows.push(row);}
        }
      }
      // Yield on a fixed line interval, even if the file has many comments or blank rows.
      if(lineIndex%300===0){if(state.downloadProgress.phase==='parse')setProgress('parse',Math.min(90,82+Math.round((cursor/Math.max(1,source.length))*8)),`Parsing ARFF records · ${rows.length.toLocaleString()} rows`);await yieldToBrowser();}
      if(end===source.length)break;
    }
    if(state.downloadProgress.phase==='parse')setProgress('parse',90,`Parsed ${rows.length.toLocaleString()} ARFF records`);
    return rows;
  }
  const SKILL_LABELS={scissorsfeint:'Scissors Feint',doubletouch:'Double Touch',flipflap:'Flip Flap',marseilleturn:'Marseille Turn',sombrero:'Sombrero',crossoverturn:'Cross Over Turn',cutbehindturn:'Cut Behind & Turn',scotchmove:'Scotch Move',steponskillcontrol:'Step On Skill control',heading:'Heading',longrangedrive:'Long Range Drive',chipshotcontrol:'Chip Shot Control',longrangeshooting:'Long Range Shooting',longrangeshot:'Long Range Shooting',knuckleshot:'Knuckle Shot',dippingshot:'Dipping Shot',dippingshots:'Dipping Shot',risingshots:'Rising Shots',acrobaticfinishing:'Acrobatic Finishing',heeltrick:'Heel Trick',firsttimeshot:'First-time Shot',onetouchpass:'One-touch Pass',throughpassing:'Through Passing',weightedpass:'Weighted Pass',pinpointcrossing:'Pinpoint Crossing',outsidecurler:'Outside Curler',rabona:'Rabona',nolookpass:'No Look Pass',lowloftedpass:'Low Lofted Pass',gklowpunt:'GK Low Punt',gkhighpunt:'GK High Punt',longthrow:'Long Throw',gklongthrow:'GK Long Throw',penaltyspecialist:'Penalty Specialist',gkpenaltysaver:'GK Penalty Saver',gamesmanship:'Gamesmanship',manmarking:'Man Marking',trackback:'Track Back',interception:'Interception',acrobaticclear:'Acrobatic Clear',captaincy:'Captaincy',supersub:'Super-sub',fightingspirit:'Fighting Spirit'};
  const COM_LABELS={trickster:'Trickster',mazingrun:'Mazing Run',speedingbullet:'Speeding Bullet',incisiverun:'Incisive Run',longballexpert:'Long Ball Expert',earlycross:'Early Cross',longranger:'Long Ranger'};
  function isEnabledSkillValue(v){return ['1','1.0','true','yes','y','on'].includes(String(v??'').trim().toLowerCase());}
  function normalizeExternalRecord(raw,index=0,source='file'){const row={...(raw||{})};const indexed=new Map(Object.entries(row).map(([k,v])=>[normalizeSlug(k),v]));const get=(...keys)=>{for(const k of keys){const key=normalizeSlug(k);if(indexed.has(key)&&indexed.get(key)!==''&&indexed.get(key)!==null&&indexed.get(key)!==undefined)return indexed.get(key);}return undefined;};
    const isFlat=Object.keys(row).some(k=>['overallrating','positionname','playername','offensiveawareness'].includes(normalizeSlug(k)));
    if(!isFlat && (row.name||row.displayName) && row.position && (row.overall!==undefined||row.rating!==undefined))return normalizePlayer(row,index);
    const attrs={...(row.attributes&&typeof row.attributes==='object'?row.attributes:{})};for(const [key,label] of ALL_ATTRS){const v=get(key,label,key.replace(/[A-Z]/g,m=>' '+m.toLowerCase()));if(v!==undefined)attrs[key]=v;}
    const existingSkills=Array.isArray(row.skills)?row.skills:(typeof row.skills==='string'?row.skills.split(/[;,|]/).map(x=>x.trim()).filter(Boolean):[]);const skills=new Set(existingSkills);const styles=new Set(Array.isArray(row.comPlayingStyles)?row.comPlayingStyles:(typeof row.comPlayingStyles==='string'?row.comPlayingStyles.split(/[;,|]/).map(x=>x.trim()).filter(Boolean):[]));
    for(const [slug,label] of Object.entries(SKILL_LABELS)){const v=get(slug,label);if(v!==undefined&&isEnabledSkillValue(v))skills.add(label);}
    for(const [slug,label] of Object.entries(COM_LABELS)){const v=get(slug,label);if(v!==undefined&&isEnabledSkillValue(v))styles.add(label);}
    const externalId=get('pesdb_id','player_id','playerid','id','pid');const name=get('player_name','name','full_name','fullname','display_name','displayname');const position=get('position_name','registered_position','primary_position','position','main_position');
    const out={...row,id:String(get('source_record_id','record_id','playerid','player_id','id')??`import-${index+1}-${normalizeSlug(name)}`),name:String(name??row.name??`Unknown player ${index+1}`),displayName:String(get('name_display','display_name','displayname','player_name')??name??`Unknown player ${index+1}`),position:String(position??'CMF').toUpperCase(),overall:get('overall_rating','overall','rating','ovr'),potential:get('potential_rating','potential'),age:get('age'),height:get('height','height_cm'),weight:get('weight','weight_kg'),nationality:get('nationality','country_name','country','nation'),club:get('team_name','club_name','team','club'),league:get('league_name','competition_name','league','competition'),foot:get('stronger_foot','preferred_foot','foot'),playingStyle:get('playing_style_name','playing_style','play_style','style'),weakFootUsage:get('weak_foot_usage','weakfootusage'),weakFootAccuracy:get('weak_foot_acc','weak_foot_accuracy'),form:get('form','form_rating'),injuryResistance:get('injury_resistance'),portraitId:get('pesmaster_id','pesmaster_player_id','portrait_id','portraitid'),portraitUrl:get('portrait_url','image_url','player_image_url','face_url'),teamId:get('pesmaster_team_id','pesmaster_team_logo_id','team_logo_id','teamlogoid'),leagueId:get('pesmaster_league_id','pesmaster_league_logo_id','league_logo_id','leaguelogoid'),teamLogoUrl:get('team_emblem_url','team_logo_url'),leagueLogoUrl:get('league_emblem_url','league_logo_url'),flagUrl:get('country_flag_url','flag_url'),sourceUrl:get('source_url','profile_url')||(source==='openml'?OPENML_DATA_URL:(source==='community'?COMMUNITY_SOURCE_URL:undefined)),sourceName:source==='openml'?'OpenML eFootball PES 2021 All Players CSV':(source==='community'?'PESXplorer community data · VirtuaRED patch v10.2':(row.sourceName||'Imported PES 2021 dataset')),datasetVersion:source==='openml'?'PES 2021 base database (2020-09-20)':(source==='community'?'PES 2021 · VirtuaRED v10.2':'PES 2021'),dataStatus:source==='community'?'IMPORTED':'AUTHENTIC',attributes:attrs,skills:[...skills],comPlayingStyles:[...styles]};
    // Preserve an explicitly supplied canonical id only when it is not just an external row index.
    if(!get('source_record_id','record_id','playerid','player_id','id'))out.id=`import-${index+1}-${normalizeSlug(name)}-${normalizeSlug(out.club)}`;
    if(!out.portraitId&&get('pesmaster_id','pesmaster_player_id','portrait_id','portraitid'))out.portraitId=String(get('pesmaster_id','pesmaster_player_id','portrait_id','portraitid'));
    return normalizePlayer(out,index);
  }
  function mergePlayerRecords(existing,incoming){const out=[...existing],ids=new Set(existing.map(p=>String(p.id))),sigs=new Set(existing.map(p=>[p.name,p.club,p.position,p.overall,p.age,p.height].map(v=>normalizeSlug(String(v??''))).join('|')));for(const p of incoming){const id=String(p.id||'');const sig=[p.name,p.club,p.position,p.overall,p.age,p.height].map(v=>normalizeSlug(String(v??''))).join('|');if((id&&ids.has(id))||sigs.has(sig))continue;out.push(p);if(id)ids.add(id);sigs.add(sig);}return out;}
  function openPitchlabDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('IndexedDB is not supported in this browser.'));const req=indexedDB.open(IDB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Unable to open browser database.'));});}
  function deletePlayerDatasetKeys(store,keys){for(const key of keys){const k=String(key);if(k===IDB_PLAYERS_KEY||k===IDB_PLAYERS_META_KEY||k.startsWith(IDB_PLAYERS_CHUNK_PREFIX))store.delete(key);}}
  async function clearPlayerDatasetInDb(){const db=await openPitchlabDb();await new Promise((resolve,reject)=>{const tx=db.transaction(IDB_STORE,'readwrite'),store=tx.objectStore(IDB_STORE),req=store.getAllKeys();req.onsuccess=()=>deletePlayerDatasetKeys(store,req.result||[]);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error||new Error('Unable to clear previous player data.'));};});}
  async function saveActivePlayers(list){
    setProgress('save',94,`Saving ${list.length.toLocaleString()} player records to browser storage`);
    try{
      // Keep small curated samples in localStorage; persist large player pools as 500-record IndexedDB chunks.
      if(list.length<1200){const serialized=JSON.stringify(list);if(serialized.length<1200000){try{localStorage.setItem(STORAGE_PLAYERS,serialized);await clearPlayerDatasetInDb();setProgress('done',100,`${list.length.toLocaleString()} player records saved`);return 'localStorage';}catch(e){/* use IndexedDB if browser storage is blocked/full */}}}
      try{localStorage.removeItem(STORAGE_PLAYERS);}catch(e){}
      const db=await openPitchlabDb();const chunkSize=500;const chunkCount=Math.ceil(list.length/chunkSize);
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(IDB_STORE,'readwrite'),store=tx.objectStore(IDB_STORE),keysReq=store.getAllKeys();let writeCount=0;
        keysReq.onsuccess=()=>{
          deletePlayerDatasetKeys(store,keysReq.result||[]);
          store.put({version:2,count:list.length,chunks:chunkCount,savedAt:Date.now()},IDB_PLAYERS_META_KEY);
          for(let i=0;i<chunkCount;i++){
            const chunk=list.slice(i*chunkSize,Math.min(list.length,(i+1)*chunkSize));
            const req=store.put(chunk,IDB_PLAYERS_CHUNK_PREFIX+i);
            req.onsuccess=()=>{writeCount++;if(writeCount%5===0||writeCount===chunkCount)setProgress('save',94+Math.floor((writeCount/Math.max(1,chunkCount))*5),`Saved storage chunks ${writeCount} / ${chunkCount}`);};
          }
        };
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error||new Error('Unable to save the large database.'));};
        tx.onabort=()=>{db.close();reject(tx.error||new Error('Browser database save was aborted.'));};
        keysReq.onerror=()=>{try{tx.abort();}catch(e){};};
      });
      setProgress('done',100,`${list.length.toLocaleString()} player records saved`);
      return `IndexedDB (${chunkCount} chunks)`;
    }catch(err){setProgress('error',0,`Save failed: ${String(err.message||err).slice(0,160)}`);throw err;}
  }
  async function readLargePlayers(){
    const db=await openPitchlabDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(IDB_STORE,'readonly'),store=tx.objectStore(IDB_STORE);let result=null,chunkResults=null,hasBrokenChunk=false;
      const metaReq=store.get(IDB_PLAYERS_META_KEY);
      metaReq.onsuccess=()=>{
        const meta=metaReq.result;
        if(meta&&Number(meta.chunks)>0&&Number(meta.chunks)<10000){
          chunkResults=new Array(meta.chunks);
          for(let i=0;i<meta.chunks;i++){const req=store.get(IDB_PLAYERS_CHUNK_PREFIX+i);req.onsuccess=()=>{chunkResults[i]=req.result;if(!Array.isArray(req.result))hasBrokenChunk=true;};}
        }else{
          const legacyReq=store.get(IDB_PLAYERS_KEY);legacyReq.onsuccess=()=>{result=legacyReq.result||null;};
        }
      };
      tx.oncomplete=()=>{db.close();if(chunkResults)resolve(hasBrokenChunk?null:chunkResults.flat());else resolve(result);};
      tx.onerror=()=>{db.close();reject(tx.error||new Error('Unable to read stored player records.'));};
      tx.onabort=()=>{db.close();reject(tx.error||new Error('Reading stored player records was aborted.'));};
    });
  }
  async function clearLargePlayers(){try{await clearPlayerDatasetInDb();}catch(e){}}
  function yieldToBrowser(){return new Promise(resolve=>setTimeout(resolve,0));}
  async function applyImportedRecords(parsed,fileName,source='file'){
    if(!Array.isArray(parsed)||!parsed.length)throw new Error('The selected source contains no records.');
    const valid=[];const batchSize=350;
    for(let start=0;start<parsed.length;start+=batchSize){
      const end=Math.min(start+batchSize,parsed.length);
      for(let i=start;i<end;i++){const raw=parsed[i];const p=normalizeExternalRecord(raw,i,source);parsed[i]=null;if(p.name&&p.position&&p.overall!==null)valid.push(p);}
      if(parsed.length>batchSize){const pct=82+Math.round((end/parsed.length)*8);setProgress('parse',Math.min(90,pct),`Processed ${end.toLocaleString()} of ${parsed.length.toLocaleString()} source records`);await yieldToBrowser();}
    }
    if(!valid.length)throw new Error('No valid PES 2021 player records were found. Expected player name, position and overall rating columns.');
    const seenIds=new Set();const uniqueRows=[];for(const p of valid){const id=String(p.id);if(seenIds.has(id))continue;seenIds.add(id);uniqueRows.push(p);}
    const merge=$('#merge-existing-data')?.checked!==false;const active=merge?mergePlayerRecords(state.players,uniqueRows):uniqueRows;
    if(!active.length)throw new Error('No player records were imported.');
    const previous=state.players;state.players=active;await rebuildDataIndexes();state.imported=true;state.selectedIds.clear();state.filters=defaultFilters();state.page=1;
    try{
      setProgress('save',94,`Saving ${state.players.length.toLocaleString()} player records to browser storage`);
      const storage=await Promise.race([saveActivePlayers(state.players),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Database save timed out after 45 seconds. Your previous database is still available; retry the save or free browser storage.')),45000))]);
      if($('#import-status'))$('#import-status').textContent=`Loaded ${uniqueRows.length.toLocaleString()} valid rows from ${fileName}; active database has ${state.players.length.toLocaleString()} players. Saved in ${storage}.`;
      if($('#full-db-status'))$('#full-db-status').textContent=`Active database: ${state.players.length.toLocaleString()} player records. Existing source-linked records were kept when merge mode was enabled.`;
      render();notify(`Database updated: ${state.players.length.toLocaleString()} player records.`);
    }catch(err){state.players=previous;await rebuildDataIndexes();throw err;}
  }
  async function loadOpenMLFullDatabase(){const status=$('#full-db-status');if(status)status.textContent='Downloading the public PES 2021 base database from OpenML…';try{const text=await fetchWithProgress(OPENML_ARFF_URL);const rows=await parseArff(text);if(rows.length<1000)throw new Error('The downloaded file did not contain the expected full player table.');setProgress('save',94,`Saving ${rows.length.toLocaleString()} imported player records`);
        await applyImportedRecords(rows,'OpenML eFootball PES 2021 All Players CSV.arff','openml');state.fullDatabaseStatus='loaded';setProgress('done',100,`${state.players.length.toLocaleString()} players saved`);render();if(status)status.textContent=`Imported ${rows.length.toLocaleString()} rows from OpenML. The source contains the PES 2021 base database; it does not include every separate Featured card in PESMASTER.`;}catch(err){state.fullDatabaseStatus='failed';setProgress('error',0,`OpenML import failed: ${String(err.message||err).slice(0,150)}`);render();if(status)status.innerHTML=`Automatic loading was blocked by the browser/network (${esc(err.message)}). Download the <a href="${OPENML_ARFF_URL}" target="_blank" rel="noopener noreferrer">OpenML ARFF file</a>, then choose it in the file importer below. Your current records are still unchanged.`;notify('Automatic download did not work; use the manual ARFF download link.');}}
  async function fetchJsonRowsInWorker(url){
    // Keep JSON download and JSON.parse off the main UI thread; emit small row batches back to the app.
    if(!('Worker' in window)||!('Blob' in window)||!window.URL?.createObjectURL){
      const payload=JSON.parse(await fetchWithProgress(url));return Array.isArray(payload)?payload:(payload.players||payload.data||payload.records||[]);
    }
    const workerSource=`self.onmessage=async function(event){
      const controller=new AbortController();const watchdog=setTimeout(()=>controller.abort(),90000);
      try{
        const response=await fetch(event.data.url,{mode:'cors',cache:'force-cache',signal:controller.signal});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const encoding=(response.headers.get('content-encoding')||'').toLowerCase();let total=encoding&&encoding!=='identity'?0:(Number(response.headers.get('content-length'))||0);let chunks=[];let bytes=0,lastReport=0;
        if(response.body&&response.body.getReader){const reader=response.body.getReader();while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);bytes+=part.value.byteLength;if(total&&bytes>total)total=0;if(bytes-lastReport>=1048576){self.postMessage({type:'download',bytes:bytes,total:total});lastReport=bytes;}}}
        else{const buffer=await response.arrayBuffer();chunks.push(buffer);bytes=buffer.byteLength;if(total&&bytes>total)total=0;self.postMessage({type:'download',bytes:bytes,total:total});}
        self.postMessage({type:'parse',bytes:bytes,total:total});
        let bodyBlob=new Blob(chunks);chunks=[];let text=await bodyBlob.text();bodyBlob=null;let payload=JSON.parse(text);text=null;let rows=Array.isArray(payload)?payload:(payload.players||payload.data||payload.records||[]);payload=null;
        if(!Array.isArray(rows)||rows.length<1000)throw new Error('Source returned '+(rows&&rows.length||0)+' records; at least 1000 were expected.');
        const count=rows.length;self.postMessage({type:'parsed',count:count});const batchSize=250;
        for(let offset=0;offset<count;offset+=batchSize){const end=Math.min(count,offset+batchSize);self.postMessage({type:'batch',rows:rows.slice(offset,end),offset:offset,count:count});for(let i=offset;i<end;i++)rows[i]=null;if(offset%1000===0)await new Promise(resolve=>setTimeout(resolve,0));}
        rows=null;self.postMessage({type:'done',count:count});
      }catch(error){self.postMessage({type:'error',message:error&&error.name==='AbortError'?'The database source timed out after 90 seconds.':String(error&&error.message||error)});}
      finally{clearTimeout(watchdog);}
    };`;
    const blobUrl=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));const worker=new Worker(blobUrl);
    return await new Promise((resolve,reject)=>{
      const rows=[];let settled=false;
      const cleanup=()=>{worker.terminate();URL.revokeObjectURL(blobUrl);};
      const fail=error=>{if(settled)return;settled=true;clearTimeout(watchdog);cleanup();reject(error instanceof Error?error:new Error(String(error)));};
      const watchdog=setTimeout(()=>fail(new Error('Background database parser timed out. Retry the download.')),100000);
      worker.onmessage=event=>{
        const data=event.data||{};
        if(data.type==='download')setProgress('download',data.total?Math.min(78,Math.round(data.bytes/data.total*78)):0,'Downloading PES 2021 records in background',data.bytes||0,data.total||0);
        else if(data.type==='parse')setProgress('parse',80,'Download complete · parsing database in background',data.bytes||0,data.total||0);
        else if(data.type==='parsed')setProgress('parse',81,`Parsed ${Number(data.count).toLocaleString()} source rows; preparing batches`);
        else if(data.type==='batch'){rows.push(...data.rows);const progress=81+Math.round(((data.offset+data.rows.length)/Math.max(1,data.count))*8);setProgress('parse',Math.min(89,progress),`Received ${Math.min(data.offset+data.rows.length,data.count).toLocaleString()} / ${Number(data.count).toLocaleString()} parsed rows`);}
        else if(data.type==='done'){if(settled)return;settled=true;clearTimeout(watchdog);cleanup();resolve(rows);}
        else if(data.type==='error')fail(new Error(data.message||'Background database parser failed.'));
      };
      worker.onerror=event=>fail(new Error(event.message||'Background database worker failed.'));
      worker.postMessage({url});
    });
  }
  async function loadCommunityFullDatabase(silent=false){
    if(state.fullDatabaseLoading)return;
    if(state.players.length>=1000&&state.fullDatabaseStatus==='loaded'){
      if(!silent)notify(`Full database is already loaded: ${state.players.length.toLocaleString()} records.`);
      return;
    }
    state.fullDatabaseLoading=true;state.fullDatabaseStatus='loading';setProgress('download',0,'Connecting to PES 2021 player data source');render();
    const previousPlayers=state.players;
    try{
      const rows=await fetchJsonRowsInWorker(COMMUNITY_DATA_URL);
      if(!Array.isArray(rows)||rows.length<1000)throw new Error(`The source returned only ${Array.isArray(rows)?rows.length:0} rows; the full player list was expected.`);
      setProgress('parse',88,`Validated ${rows.length.toLocaleString()} source records; identifying teams and leagues`);
      setProgress('save',94,'Saving verified player records to browser storage (this may take time)');
      await applyImportedRecords(rows,'PESXplorer full PES 2021 dataset (VirtuaRED v10.2)','community');
      if(state.players.length<1000)throw new Error(`Only ${state.players.length} usable player records were imported from ${rows.length} source rows.`);
      state.fullDatabaseStatus='loaded';setProgress('done',100,`${state.players.length.toLocaleString()} players saved · images and transfers depend on source availability`);render();
      if(!silent)notify(`Loaded ${state.players.length.toLocaleString()} PES 2021 player records.`);
    }catch(err){
      // Keep the existing database intact and try the smaller base database as a fallback.
      state.players=previousPlayers;await rebuildDataIndexes();
      state.fullDatabaseStatus='fallback';setProgress('fallback',0,'Trying OpenML backup source');render();
      console.warn('PitchLab community database load failed:',err);
      try{
        const text=await fetchWithProgress(OPENML_ARFF_URL);
        const rows=await parseArff(text);
        if(rows.length<1000)throw new Error(`OpenML returned only ${rows.length} rows.`);
        await applyImportedRecords(rows,'OpenML eFootball PES 2021 All Players CSV.arff','openml');
        if(state.players.length<1000)throw new Error('The base dataset did not produce 1,000 usable player records.');
        state.fullDatabaseStatus='loaded';setProgress('done',100,`${state.players.length.toLocaleString()} players saved · missing images and transfers are not downloaded`);render();
        if(!silent)notify(`Loaded ${state.players.length.toLocaleString()} players from the PES 2021 base database. Portrait links may be unavailable for records without exact IDs.`);
      }catch(fallbackErr){
        state.players=previousPlayers;await rebuildDataIndexes();
        state.fullDatabaseStatus='failed';setProgress('error',0,`Import failed: ${String(fallbackErr.message).slice(0,140)}. Existing records were kept`);
        state.fullDatabaseError=`Community source: ${err.message}. OpenML fallback: ${fallbackErr.message}.`;
        render();
        if(!silent)notify('Could not download the full database. Start the local server and retry with internet connected.');
        console.warn('PitchLab OpenML fallback failed:',fallbackErr);
      }
    }finally{state.fullDatabaseLoading=false;render();}
  }
  function downloadAssetTemplate(){
    const template=[
      {name:'Lionel Messi',club:'Barcelona',portraitId:'18881879',portraitUrl:'',teamLogoId:'',league:'Spanish League',leagueLogoId:'',sourceUrl:'https://www.pesmaster.com/pes-2021/player/...'},
      {name:'Cristiano Ronaldo',club:'Juventus',portraitId:'198185386',teamLogoId:'',league:'Serie A TIM',leagueLogoId:''}
    ];
    download('pitchlab21-pesmaster-asset-map-template.json',JSON.stringify(template,null,2),'application/json');
  }
  function importAssetMapFile(file){
    if(!file)return;
    const status=$('#asset-map-status');if(status)status.textContent=`Reading ${file.name}…`;
    const reader=new FileReader();reader.onload=async()=>{
      try{
        const raw=String(reader.result||'');let parsed;
        if(/\.json$/i.test(file.name)||raw.trim().startsWith('[')||raw.trim().startsWith('{')){parsed=JSON.parse(raw);if(!Array.isArray(parsed))parsed=parsed.assets||parsed.players||parsed.data||parsed.records||[];}
        else parsed=parseCsv(raw);
        if(!Array.isArray(parsed)||!parsed.length)throw new Error('No image/badge mappings were found.');
        let playerPhotos=0,teamBadges=0,leagueBadges=0,unmatched=0;
        const updated=state.players.map(player=>({...player}));
        const idMap=new Map(),nameMap=new Map(),nameClubMap=new Map(),clubMap=new Map(),leagueMap=new Map();
        const push=(map,key,p)=>{if(!key)return;let arr=map.get(key);if(!arr){arr=[];map.set(key,arr);}arr.push(p);};
        for(const p of updated){push(idMap,String(p.id),p);push(nameMap,normalizeSlug(p.name||p.displayName),p);push(nameClubMap,normalizeSlug(p.name||p.displayName)+'|'+normalizeSlug(p.club),p);push(clubMap,normalizeSlug(p.club),p);push(leagueMap,normalizeSlug(p.league),p);}
        for(let rowIndex=0;rowIndex<parsed.length;rowIndex++){
          const row=parsed[rowIndex];
          if(rowIndex&&rowIndex%300===0){if(status)status.textContent=`Matching asset records ${rowIndex.toLocaleString()} / ${parsed.length.toLocaleString()}…`;await yieldToBrowser();}
          const map=new Map(Object.entries(row||{}).map(([k,v])=>[normalizeSlug(k),v]));
          const get=(...keys)=>{for(const k of keys){const key=normalizeSlug(k);const value=map.get(key);if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;}return undefined;};
          const name=get('name','player_name','playername','full_name','display_name');
          const club=get('club','team','club_name','team_name');
          const league=get('league','league_name','competition');
          const sourceId=get('record_id','source_record_id','active_player_id');
          const portraitId=get('portrait_id','portraitid','pesmaster_id','pesmasterid','pesmaster_player_id');
          const portraitUrlValue=get('portrait_url','portraiturl','player_image_url','image_url','face_url');
          const teamLogoId=get('team_logo_id','teamlogoid','pesmaster_team_logo_id');
          const leagueLogoId=get('league_logo_id','leaguelogoid','pesmaster_league_logo_id');
          let matched=[];
          if(sourceId!==undefined)matched=idMap.get(String(sourceId))||[];
          if(!matched.length&&name!==undefined){
            const n=normalizeSlug(name),c=club!==undefined?normalizeSlug(club):'';
            matched=c?(nameClubMap.get(n+'|'+c)||[]):(nameMap.get(n)||[]);
            if(!c&&matched.length!==1)matched=[];
          }
          if(!matched.length&&(club!==undefined&&teamLogoId!==undefined||league!==undefined&&leagueLogoId!==undefined)){
            let candidates=club!==undefined&&teamLogoId!==undefined?(clubMap.get(normalizeSlug(club))||[]):null;
            if(league!==undefined&&leagueLogoId!==undefined){const byLeague=leagueMap.get(normalizeSlug(league))||[];candidates=candidates?candidates.filter(p=>normalizeSlug(p.league)===normalizeSlug(league)):byLeague;}
            matched=candidates||[];
          }
          if(!matched.length){unmatched++;continue;}
          for(const player of matched){
            if((portraitId!==undefined||portraitUrlValue!==undefined)&&!player.portraitId&&!player.portraitUrl){
              if(portraitId!==undefined&&/^\d+$/.test(String(portraitId).trim()))player.portraitId=String(portraitId).trim();
              else if(portraitUrlValue!==undefined&&/^https:\/\//i.test(String(portraitUrlValue).trim()))player.portraitUrl=String(portraitUrlValue).trim();
              if(player.portraitId||player.portraitUrl)playerPhotos++;
            }
            if(teamLogoId!==undefined&&!player.teamLogoId){player.teamLogoId=String(teamLogoId).trim();if(!player.teamId)player.teamId=String(teamLogoId).trim();teamBadges++;}
            if(leagueLogoId!==undefined&&!player.leagueLogoId){player.leagueLogoId=String(leagueLogoId).trim();if(!player.leagueId)player.leagueId=String(leagueLogoId).trim();leagueBadges++;}
          }
        }
        if(!playerPhotos&&!teamBadges&&!leagueBadges)throw new Error(`No new exact asset IDs matched the current database (${unmatched} unmatched mapping rows).`);
        state.players=updated;await rebuildDataIndexes();state.imported=state.imported||true;const storage=await Promise.race([saveActivePlayers(state.players),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Database save timed out; browser storage may be blocked or full. Try a different browser or allow site storage.')),18000))]);
        if(status)status.textContent=`Applied ${playerPhotos} player-portrait mappings, ${teamBadges} team-logo mappings, and ${leagueBadges} league-emblem mappings. ${unmatched} rows did not match. Existing image IDs were preserved. Saved in ${storage}.`;
        render();notify('PES 2021 asset mappings applied without changing player statistics.');
      }catch(err){setProgress('error',0,`Asset mapping failed: ${String(err.message||err).slice(0,150)}`);if(status)status.textContent=`Asset mapping failed: ${err.message}`;notify('Asset mapping failed. Check the player/team names and asset IDs.');}
    };
    reader.onerror=()=>{if(status)status.textContent='Could not read the asset mapping file.';};reader.readAsText(file);
  }
  function renderImport(){const sample=`[\n  {\n    "id": "my-player-1",\n    "name": "Player Name",\n    "position": "CMF",\n    "overall": 82,\n    "potential": null,\n    "age": 21,\n    "height": 178,\n    "nationality": "Country",\n    "club": "Club Name",\n    "league": "League Name",\n    "foot": "Right",\n    "playingStyle": "Box-to-Box",\n    "portraitId": "PESMASTER image id, when supplied by source",\n    "teamId": 103,\n    "leagueId": 9,\n    "attributes": { "lowPass": 84, "speed": 79 },\n    "skills": ["Through Passing"]\n  }\n]`;
    return `${heading(tr('Data Import'),'Manage your official PESMASTER PES 2021 player catalogue.',`<button class="btn" data-action="download-template">↓ JSON template</button><button class="btn" data-action="reset-demo">Restore PESMASTER catalogue</button>`)}
      <div class="section-card full-database-source"><div class="section-head"><div><h2>🌍 ${state.lang==='ar'?'مصادر قاعدة بيانات PES 2021 الكاملة':'Full PES 2021 database sources'}</h2><p>${state.lang==='ar'?'حمّل قاعدة كبيرة أو استورد ملف CSV من PESMASTER. لن تُستبدل السجلات الحالية عند تفعيل الدمج.':'Load a larger player database. Merge mode keeps the existing source-linked entries instead of replacing them.'}</p></div><span class="pill pill-purple">External download required</span></div><div class="section-body"><div class="source-choice-grid">
        <div class="source-choice"><div class="source-choice-icon">⚽</div><h3>${state.lang==='ar'?'تحميل قاعدة اللاعبين الكاملة تلقائيًا':'Load full player database automatically'}</h3><p>${state.lang==='ar'?'قاعدة مجتمعية كبيرة للاعبين وخصائصهم وصورهم وشعارات أنديتهم. مصدرها VirtuaRED PES 2021 v10.2 وليست نسخة PESMASTER الأصلية حرفيًا.':'A large community database with player records, attributes, portraits, flags and team emblems. It is based on VirtuaRED PES 2021 v10.2, not an exact PESMASTER export.'}</p><div class="source-choice-actions"><button class="btn btn-primary" data-action="load-community-db" ${state.fullDatabaseLoading?'disabled':''}>${state.fullDatabaseLoading?'Loading…':(state.fullDatabaseStatus==='loaded'?'Refresh full database':'Load and merge full database')}</button><a class="btn" href="${COMMUNITY_SOURCE_URL}" target="_blank" rel="noopener noreferrer">View source</a></div><small>Large external dataset; internet required on first load. Existing local records are preserved.</small></div><div class="source-choice"><div class="source-choice-icon">▦</div><h3>${state.lang==='ar'?'قاعدة PES 2021 الأساسية':'PES 2021 base database'}</h3><p>${state.lang==='ar'?'مجموعة عامة منشورة على OpenML: 14,693 لاعبًا و120 حقلًا. التحميل الكامل يتم من المصدر مباشرة.':'Public OpenML dataset: 14,693 players and 120 fields. This is the base dataset, not all Featured/duplicate cards shown by PESMASTER.'}</p><div class="source-choice-actions"><button class="btn btn-primary" data-action="load-openml-db">${state.lang==='ar'?'تحميل ودمج تلقائي':'Fetch and merge'}</button><a class="btn" href="${OPENML_ARFF_URL}" target="_blank" rel="noopener noreferrer">${state.lang==='ar'?'تنزيل ملف ARFF':'Download ARFF'}</a></div><small>Source: <a href="${OPENML_DATA_URL}" target="_blank" rel="noopener noreferrer">OpenML #43649</a> · GPL-2.0</small></div>
        <div class="source-choice"><div class="source-choice-icon">⚽</div><h3>${state.lang==='ar'?'قاعدة PESMASTER':'PESMASTER database'}</h3><p>${state.lang==='ar'?'صفحة PESMASTER مرجع لبيانات اللاعبين وصورهم، لكن لم أتحقق من وجود ملف تنزيل شامل لكل الصور والمعرّفات. لو عندك ملف CSV/JSON مسموح باستخدامه ويحتوي معرّفات الصور والشعارات، ارفعه في قسم ربط الأصول أسفل الصفحة.':'PESMASTER is linked as a reference for its player entries and portraits, but a complete downloadable portrait/logo-ID manifest is not verified here. Import a permitted CSV/JSON asset map with exact IDs in the section below.'}</p><div class="source-choice-actions"><a class="btn btn-primary" href="${PESMASTER_SEARCH_URL}" target="_blank" rel="noopener noreferrer">${state.lang==='ar'?'فتح PESMASTER':'Open PESMASTER'}</a></div><small>${state.lang==='ar'?'صور PESMASTER وشعاراته ملك لأصحاب الحقوق وتُحمّل من خوادمهم عند توفر المعرّف.':'The player-stat source does not provide a complete verified map to PESMASTER portraits and emblems; those IDs must be included in a matching source file.'}</small></div>
      </div><div id="full-db-status" class="tiny muted" role="status" aria-live="polite">${state.lang==='ar'?'اللاعبون الحاليون لن يتغيروا عند استخدام خيار الدمج.':'Your existing records are preserved when merge mode is enabled.'}</div></div></div>
      <div class="import-grid"><div class="section-card"><div class="section-head"><div><h2>⇧ ${tr('Import CSV / JSON')} / ARFF</h2><p>CSV, JSON or OpenML ARFF dataset file</p></div><span class="pill pill-purple">LOCAL</span></div><div class="section-body"><div class="drop-zone"><div class="drop-icon">⇧</div><h3>${tr('Use your own PES 2021 dataset')}</h3><p>${state.lang==='ar'?'اختار ملف CSV أو JSON أو ARFF. فعّل الدمج علشان تحتفظ باللاعبين الحاليين بدون تعديل.':'Select a CSV, JSON or ARFF file. Use merge mode to retain every currently loaded record.'}</p><label class="file-label">Choose file<input id="dataset-file" type="file" accept=".csv,.json,.arff,application/json,text/csv,text/plain,application/octet-stream"></label><label class="merge-toggle"><input id="merge-existing-data" type="checkbox" checked> <span><strong>${state.lang==='ar'?'دمج مع البيانات الحالية':'Merge with current data'}</strong><small>${state.lang==='ar'?'يحافظ على سجلات اللاعبين الحالية ولا يستبدلها.':'Preserve existing player records; do not overwrite them.'}</small></span></label><div id="import-status" class="tiny muted" style="margin-top:10px">No file selected.</div></div><div class="notice-list" style="margin-top:18px"><div class="notice-item"><span class="notice-bullet">✓</span><span><strong>One shared data source.</strong> Search, player profiles, comparison, team lists and squad builder use the merged records.</span></div><div class="notice-item"><span class="notice-bullet">✓</span><span><strong>Large-dataset storage.</strong> Large imports are kept in IndexedDB, not localStorage, to avoid browser quota limits.</span></div><div class="notice-item"><span class="notice-bullet">!</span><span><strong>Images and badges.</strong> The OpenML stats file does not guarantee PESMASTER portrait/logo IDs. Existing player portraits and badges are preserved; new exact images appear only when the imported source includes matching PESMASTER IDs or image URLs.</span></div></div></div></div>
      <div class="section-card asset-map-card"><div class="section-head"><div><h2>🖼️ Attach exact PESMASTER images &amp; badges</h2><p>Import an asset manifest separately, without changing player ratings, names, positions or attributes.</p></div><span class="pill pill-purple">ASSETS ONLY</span></div><div class="section-body"><p class="tiny muted" style="margin-top:0;line-height:1.7">Use a CSV/JSON file with a player's <code>name</code> and preferably <code>club</code>, plus <code>portraitId</code> or a verified <code>portraitUrl</code>. Club/league rows can supply <code>teamLogoId</code> and <code>leagueLogoId</code>. The importer only fills missing asset IDs; images already set on existing players are not overwritten.</p><label class="file-label">Choose asset map<input id="asset-map-file" type="file" accept=".csv,.json,application/json,text/csv,text/plain"></label> <button class="btn btn-sm" data-action="download-asset-template">Download asset-map template</button><div id="asset-map-status" class="tiny muted" style="margin-top:10px" role="status" aria-live="polite">No asset map selected. The OpenML statistics file by itself does not contain all exact PESMASTER image IDs.</div></div></div>
      <div class="section-card"><div class="section-head"><div><h2>Supported JSON structure</h2><p>Recommended fields and format</p></div><span class="pill pill-gray">SCHEMA</span></div><div class="section-body"><div class="code-sample">${esc(sample)}</div><p class="tiny muted" style="line-height:1.7">CSV uses the same basic field names as columns. Attribute columns can be nested as an <code>attributes</code> JSON object in JSON imports, or supplied as flat columns such as <code>lowPass</code>, <code>speed</code>, and <code>gkReflexes</code>. Skills can be arrays or columns with a value of 1. Explicit <code>portraitId</code>, <code>teamId</code> and <code>leagueId</code> fields allow source-matched PESMASTER graphics.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" data-action="download-template">Download sample JSON</button><button class="btn" data-action="export-json">Export current data backup</button></div></div></div></div>
      ${doctorPanel()}<div class="section-card" style="margin-top:16px"><div class="section-head"><h2>Production database path</h2><span class="pill pill-amber">Optional PostgreSQL / Supabase</span></div><div class="section-body"><p class="tiny muted" style="line-height:1.7;margin-top:0">This distributable version remains browser-first. <code>supabase/schema.sql</code> provides a normalized schema if you later deploy a large multi-user database.</p></div></div>`;
  }
  function renderContent(){state.route=routeNow();switch(state.route.page){case 'home':return renderHome();case 'search':return renderSearch();case 'player':return renderProfile(state.route.params[0]);case 'pesmaster-player':return renderOfficialPlayerProfile(state.route.params[0],state.route.params[1],state.route.params[2]);case 'compare':return renderCompare();case 'coaches':return renderCoaches();case 'coach':return renderCoachDetail(state.route.params[0]);case 'tactics':return renderTactics();case 'tactic':return renderTacticDetail(state.route.params[0],state.route.params[1]);case 'teams':return renderTeams();case 'team':return renderTeamDetail(state.route.params[0]||'','team');case 'leagues':return renderLeagues();case 'league':return renderTeamDetail(state.route.params[0]||'','league');case 'master-league':return renderMasterLeague();case 'squad':return renderSquad();case 'import':return renderImport();default:return renderHome();}}
  function render(){
    state.route=routeNow();$('#app').innerHTML=shell(renderContent());document.title=`PitchLab 21 — ${state.route.page==='home'?'PES 2021 Database':state.route.page[0].toUpperCase()+state.route.page.slice(1)}`;
    if(PLAYER_CATALOG_ROUTES.has(state.route.page)&&state.players.length<1000&&!state.fullDatabaseLoading&&state.fullDatabaseStatus!=='failed'){
      clearTimeout(state.playerCatalogKickTimer);state.playerCatalogKickTimer=setTimeout(()=>{
        const loadPlayers=()=>loadPesmasterPlayerCatalog();
        if(TEAM_CATALOG_ROUTES.has(state.route.page))ensureTeamCatalog().then(loadPlayers);else loadPlayers();
      },40);
    }else clearTimeout(state.playerCatalogKickTimer);
    if(TEAM_CATALOG_ROUTES.has(state.route.page)&&!state.teamCatalogScriptLoaded&&!state.teamCatalogScriptFailed){
      clearTimeout(state.teamCatalogKickTimer);state.teamCatalogKickTimer=setTimeout(()=>ensureTeamCatalog(),40);
    }else clearTimeout(state.teamCatalogKickTimer);
    if(COACH_DATA_ROUTES.has(state.route.page)&&!state.coachDataScriptLoaded&&!state.coachDataScriptFailed){
      clearTimeout(state.coachDataKickTimer);state.coachDataKickTimer=setTimeout(()=>ensureCoachData(),40);
    }else clearTimeout(state.coachDataKickTimer);
  }
  function escapeCsv(v){const str=v===null||v===undefined?'':String(v);return /[",\n\r]/.test(str)?`"${str.replace(/"/g,'""')}"`:str;}
  function download(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportCsv(){const arr=filteredPlayers();const headers=['id','name','displayName','position','secondaryPositions','overall','potential','age','height','weight','nationality','club','league','foot','playingStyle','weakFootUsage','weakFootAccuracy','form','injuryResistance','skills','comPlayingStyles',...ATTRS.flatMap(g=>g[1].map(a=>a[0]))];const rows=arr.map(p=>headers.map(h=>{let v;if(h==='secondaryPositions'||h==='skills'||h==='comPlayingStyles')v=(p[h]||[]).join(';');else if(ATTR_LABELS[h])v=p.attributes?.[h];else if(Object.keys(p).includes(h))v=p[h];else v=p.attributes?.[h];return escapeCsv(v);}).join(','));download('pitchlab21-filtered-players.csv',[headers.join(','),...rows].join('\r\n'),'text/csv;charset=utf-8;');notify(`Exported ${arr.length} player records to CSV.`);}
  function exportJson(){download('pitchlab21-player-dataset.json',JSON.stringify(state.players,null,2),'application/json;charset=utf-8');notify('Current dataset downloaded as JSON.');}
  function downloadTemplate(){const template=[{id:'my-player-1',name:'Player Name',displayName:'Player Name',position:'CMF',secondaryPositions:['DMF'],overall:82,potential:88,age:21,height:178,weight:73,nationality:'Country',club:'Club Name',league:'League Name',foot:'Right',playingStyle:'Box-to-Box',weakFootUsage:3,weakFootAccuracy:3,form:6,injuryResistance:2,attributes:{offensiveAwareness:78,ballControl:82,dribbling:80,tightPossession:81,lowPass:84,loftedPass:80,finishing:70,heading:65,placeKicking:72,curl:74,speed:79,acceleration:80,kickingPower:78,jump:70,physicalContact:72,balance:80,stamina:86,defensiveAwareness:72,ballWinning:74,aggression:73,gkAwareness:null,gkCatching:null,gkClearing:null,gkReflexes:null,gkReach:null},skills:['Through Passing','One-touch Pass'],comPlayingStyles:['Long Ranger']}];download('pitchlab21-import-template.json',JSON.stringify(template,null,2),'application/json');}
  function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(quoted){if(c==='"'&&next==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else{if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}}if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}if(rows.length<2)return [];const headers=rows.shift().map(h=>h.trim());return rows.filter(r=>r.some(v=>String(v).trim()!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])));}
  function importFile(file){if(!file)return;const status=$('#import-status');if(status)status.textContent=`Reading ${file.name}…`;const reader=new FileReader();reader.onload=async()=>{try{const raw=String(reader.result||'');let parsed;let source='file';if(/\.arff$/i.test(file.name)||/^\s*@relation\b/im.test(raw)){parsed=await parseArff(raw);source='openml';}else if(/\.json$/i.test(file.name)||raw.trim().startsWith('[')||raw.trim().startsWith('{')){parsed=JSON.parse(raw);if(!Array.isArray(parsed))parsed=parsed.players||parsed.data||parsed.records||[];}else parsed=parseCsv(raw);if(!Array.isArray(parsed)||!parsed.length)throw new Error('No player records were found in this file.');await applyImportedRecords(parsed,file.name,source);}catch(err){setProgress('error',0,`Import failed: ${String(err.message||err).slice(0,150)}`);if(status)status.textContent=`Import failed: ${err.message}`;notify('Import failed. Check the file format and required fields.');}};reader.onerror=()=>{setProgress('error',0,'Could not read the selected file.');if(status)status.textContent='Could not read the file.';};reader.readAsText(file);}

  function filterTacticCards(){const cards=$$('[data-tactic-card]');let n=0;cards.forEach(card=>{const matchQ=!state.tacticQuery||card.dataset.search.includes(state.tacticQuery);const matchStyle=state.tacticStyle==='ALL'||card.dataset.style===state.tacticStyle;const show=matchQ&&matchStyle;card.hidden=!show;if(show)n++;});const count=$('#tactics-count');if(count)count.textContent=`${n} ${state.lang==='ar'?'فرق':'teams'}`;}
  function toggleSelect(id,checked){id=String(id);if(checked){if(state.selectedIds.size>=4&&!state.selectedIds.has(id)){notify('You can compare up to four players at once.');return false;}state.selectedIds.add(id);}else state.selectedIds.delete(id);return true;}
  function openPicker(index){state.activeSlot=Number(index);state.pickerOpen=true;state.pickerPage=0;state.pickerSearch='';const modal=$('#picker-modal');if(modal){$('#picker-title').textContent=`Choose a player for ${squadAssignments()[state.activeSlot]?.[0]||'position'}`;$('#picker-search').value='';$('#picker-list').innerHTML=renderPickerOptions();modal.classList.add('open');setTimeout(()=>$('#picker-search')?.focus(),30);}}
  function closePicker(){state.pickerOpen=false;$('#picker-modal')?.classList.remove('open');}
  function clearSquad(){state.squad={};render();notify('Squad cleared.');}
  function saveSquad(){localStorage.setItem(STORAGE_SQUAD,JSON.stringify({formation:state.formation,squad:state.squad,savedAt:new Date().toISOString()}));notify('Squad saved in this browser.');}
  function loadSquad(){try{const data=JSON.parse(localStorage.getItem(STORAGE_SQUAD)||'null');if(!data){notify(tr('No squad saved yet'));return;}state.formation=FORMATIONS[data.formation]?data.formation:'4-3-3';state.squad=data.squad||{};render();notify('Saved squad loaded.');}catch(e){notify('Could not load the saved squad.');}}
  function clearFilters(){state.filters=defaultFilters();state.page=1;render();}
  function handleRouteAction(route){if(route==='search'&&state.route.page==='search')return;go(route);}
  document.addEventListener('click',e=>{
    const target=e.target.closest('button,[data-player],[data-team],[data-league],[data-action]');if(!target)return;
    if(target.dataset.route!==undefined){e.preventDefault();go(target.dataset.route);return;}
    if(target.dataset.pesmasterPlayer){go(`pesmaster-player/${encodeURIComponent(target.dataset.pesmasterPlayer)}/${encodeURIComponent(target.dataset.playerSource||'')}/${encodeURIComponent(target.dataset.parentTeam||'')}`);return;}
    if(target.dataset.player){const player=byId(target.dataset.player);if(player?.pesmasterPlayerId){go(`pesmaster-player/${encodeURIComponent(player.pesmasterPlayerId)}/${encodeURIComponent(player.sourceUrl||'')}/${encodeURIComponent(player.teamId||'')}`);return;}go('player/'+encodeURIComponent(target.dataset.player));return;}
    if(target.dataset.team){state.teamPosition='ALL';state.teamQuery='';state.rosterPage=1;const parentLeague=target.dataset.parentLeague;const teamId=target.dataset.teamId;let path='team/'+encodeURIComponent(target.dataset.team);if(parentLeague||teamId){path+='/'+encodeURIComponent(parentLeague||'');}if(teamId)path+='/'+encodeURIComponent(teamId);go(path);return;}
    if(target.dataset.league){state.teamPosition='ALL';state.teamQuery='';state.leagueTeamsPage=1;go('league/'+encodeURIComponent(target.dataset.league));return;}
    if(target.dataset.rosterPosition){state.teamPosition=target.dataset.rosterPosition;state.rosterPage=1;render();return;}
    if(target.dataset.quickPosition){state.filters=defaultFilters();state.filters.positions=[target.dataset.quickPosition];go('search');return;}
    if(target.dataset.sort){const key=target.dataset.sort;if(state.sortKey===key)state.sortDir=state.sortDir==='asc'?'desc':'asc';else{state.sortKey=key;state.sortDir=key==='name'?'asc':'desc';}state.page=1;updateResultsOnly();return;}
    if(target.dataset.page){state.page=Number(target.dataset.page);updateResultsOnly();return;}
    if(target.dataset.entityPage){state.teamsPage=Math.max(1,state.teamsPage+(target.dataset.entityPage==='next'?1:-1));render();return;}
    if(target.dataset.leagueClubPage){state.leagueTeamsPage=Math.max(1,state.leagueTeamsPage+(target.dataset.leagueClubPage==='next'?1:-1));render();return;}
    if(target.dataset.rosterPage){state.rosterPage=Math.max(1,state.rosterPage+(target.dataset.rosterPage==='next'?1:-1));render();return;}
    if(target.dataset.slot!==undefined){openPicker(target.dataset.slot);return;}
    if(target.dataset.assignPlayer){if(state.activeSlot!==null){state.squad[state.activeSlot]=target.dataset.assignPlayer;closePicker();render();notify('Player assigned to the squad.');}return;}
    if(target.dataset.action){const action=target.dataset.action;
      if(action==='master-league-start'){startMasterLeagueCareer();return;}
      if(action==='master-league-simulate'){simulateMasterLeagueMatchday();return;}
      if(action==='master-league-next-season'){const career=state.masterLeagueCampaign;if(career){career.season++;career.seed=(Date.now()^masterLeagueHash(`${career.teamId}:${career.season}`))>>>0;career.results=[];persistMasterLeague();render();notify(state.lang==='ar'?'بدأ موسم جديد.':'The next season has started.');}return;}
      if(action==='master-league-new-career'){if(!confirm(state.lang==='ar'?'بدء مسيرة جديدة سيمسح نتائج هذا الموسم. هل تريد المتابعة؟':'Starting a new career will erase this season’s results. Continue?'))return;const career=state.masterLeagueCampaign;if(career){state.masterLeagueLeagueId=career.leagueId;state.masterLeagueTeamId=career.teamId;}state.masterLeagueCampaign=null;persistMasterLeague();render();return;}
      if(action==='retry-team-roster'){const id=String(target.dataset.id||'');state.officialRosters.delete(id);state.officialRosterErrors.delete(id);requestOfficialTeamRoster(id,true);render();return;}
      if(action==='retry-player-profile'){const id=String(target.dataset.id||'');const source=String(target.dataset.source||'');state.officialPlayerProfiles.delete(id);state.officialPlayerErrors.delete(id);requestOfficialPlayerProfile(id,source,true);render();return;}
      if(action==='language'){state.lang=state.lang==='ar'?'en':'ar';localStorage.setItem('pitchlab21-lang',state.lang);render();return;}
      if(action==='apply-filters'){state.page=1;updateResultsOnly();notify('Filters applied.');return;}
      if(action==='clear-filters'){clearFilters();return;}
      if(action==='view-table'){state.view='table';updateResultsOnly();return;}
      if(action==='view-card'){state.view='card';updateResultsOnly();return;}
      if(action==='compare-selected'){if(state.selectedIds.size<2){notify('Select at least two players to compare.');return;}go('compare');return;}
      if(action==='export-csv'){exportCsv();return;}
      if(action==='export-json'){exportJson();return;}
      if(action==='download-template'){downloadTemplate();return;}
      if(action==='download-asset-template'){downloadAssetTemplate();return;}
      if(action==='load-openml-db'){loadOpenMLFullDatabase();return;}
      if(action==='load-community-db'){loadCommunityFullDatabase(false);return;}
      if(action==='refresh-team-catalog'){state.officialCatalogStatus={...state.officialCatalogStatus,status:'running',phase:'Refreshing official PESMASTER team links',leaguesProcessed:0,teamCount:state.officialTeams.length,error:''};state.teamCatalogScriptFailed=false;render();ensureTeamCatalog(true);notify('Refreshing official PESMASTER team list.');return;}
      if(action==='load-pesmaster-catalog'){state.fullDatabaseStatus='idle';loadPesmasterPlayerCatalog();return;}
      if(action==='doctor-fix'){const d=diagnose();const el=$('#doctor-result');if(el)el.textContent=`Checked: ${d.players} players, ${d.coaches} coaches, ${d.clubs} clubs. ${d.portraitsMissing} portraits unverified. ${d.players<1000?'Retrying database download…':'Existing dataset preserved.'}`;if(d.players<1000&&!state.fullDatabaseLoading)loadCommunityFullDatabase(false);return;}
       if(action==='reset-demo'){if(!confirm('Replace the current player list and imported records with the official PESMASTER PES 2021 Advanced Search catalogue?'))return;restorePesmasterPlayerCatalog();return;}
      if(action==='compare-player'){const id=target.dataset.id;if(!state.selectedIds.has(String(id))&&state.selectedIds.size>=4){notify('You can compare up to four players.');return;}state.selectedIds.add(String(id));go('compare');return;}
      if(action==='add-compare-player'){const select=$('#compare-player-select');const id=select?.value;if(!id){notify('Choose a player first.');return;}if(!toggleSelect(id,true))return;state.compareQuery='';render();return;}
      if(action==='remove-compare-player'){state.selectedIds.delete(String(target.dataset.id));render();return;}
      if(action==='clear-compare'){state.selectedIds.clear();render();return;}
      if(action==='select-for-compare'){if(!toggleSelect(target.dataset.id,true))return;notify('Player added to comparison.');return;}
      if(action==='select-page'){const inputs=$$('[data-select-player]');const shouldCheck=target.checked;inputs.forEach(inp=>{inp.checked=shouldCheck;toggleSelect(inp.dataset.selectPlayer,shouldCheck);});updateResultsOnly();return;}
      if(action==='close-picker'){closePicker();return;}
      if(action==='picker-page-prev'||action==='picker-page-next'){state.pickerPage=Math.max(0,state.pickerPage+(action==='picker-page-next'?1:-1));const list=$('#picker-list');if(list){list.innerHTML=renderPickerOptions();list.scrollTop=0;}return;}
      if(action==='clear-active-slot'){if(state.activeSlot!==null)delete state.squad[state.activeSlot];closePicker();render();notify('Player removed from position.');return;}
      if(action==='save-squad'){saveSquad();return;}
      if(action==='load-squad'){loadSquad();return;}
      if(action==='clear-squad'){clearSquad();return;}
    }
  });
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='ml-league-select'){state.masterLeagueLeagueId=String(t.value||'');state.masterLeagueTeamId='';render();return;}
    if(t.id==='ml-team-select'){state.masterLeagueTeamId=String(t.value||'');return;}
    if(t.matches('[data-filter]')){state.filters[t.dataset.filter]=t.value;state.page=1;clearTimeout(state.filterTimer);state.filterTimer=setTimeout(()=>{if(state.route.page==='search')updateResultsOnly();},130);}
    if(t.matches('[data-position]')){const pos=t.dataset.position;const positions=new Set(state.filters.positions||[]);t.checked?positions.add(pos):positions.delete(pos);state.filters.positions=[...positions];state.page=1;updateResultsOnly();}
    if(t.matches('[data-skill]')){const skill=t.dataset.skill;const list=new Set(state.filters.skills||[]);t.checked?list.add(skill):list.delete(skill);state.filters.skills=[...list];state.page=1;updateResultsOnly();}
    if(t.matches('[data-select-player]')){toggleSelect(t.dataset.selectPlayer,t.checked);updateResultsOnly();}
    if(t.matches('[data-pagesize]')){state.pageSize=Number(t.value)||15;state.page=1;updateResultsOnly();}
    if(t.id==='formation-select'){state.formation=t.value;state.activeSlot=null;render();notify(`Formation changed to ${state.formation}.`);}
    if(t.id==='dataset-file'){importFile(t.files?.[0]);}if(t.id==='coach-file'){importCoachFile(t.files?.[0]);}if(t.id==='asset-map-file'){importAssetMapFile(t.files?.[0]);}if(t.id==='tactics-style-filter'){state.tacticStyle=t.value;filterTacticCards();}
    if(t.matches('[data-roster-position]')){state.teamPosition=t.dataset.rosterPosition;render();}
  });
  document.addEventListener('input',e=>{
    const t=e.target;
    if(t.matches('[data-filter]')){state.filters[t.dataset.filter]=t.value;state.page=1;clearTimeout(state.filterTimer);state.filterTimer=setTimeout(()=>{if(state.route.page==='search')updateResultsOnly();},130);}
    if(t.id==='compare-player-search'){state.compareQuery=t.value;const select=$('#compare-player-select');if(select)select.innerHTML=compareOptions();}
    if(t.id==='picker-search'){state.pickerSearch=t.value;state.pickerPage=0;const list=$('#picker-list');if(list)list.innerHTML=renderPickerOptions();}if(t.id==='coach-search'){state.coachQuery=t.value.toLowerCase().trim();const cards=$$('[data-coach-card]');let n=0;cards.forEach(card=>{const show=!state.coachQuery||card.dataset.search.includes(state.coachQuery);card.hidden=!show;if(show)n++;});const count=$('#coach-count');if(count)count.textContent=`${n} ${state.lang==='ar'?'مدربين':'managers'}`;}if(t.id==='tactics-search'){state.tacticQuery=t.value.toLowerCase().trim();filterTacticCards();}
    if(t.id==='team-roster-search'){state.teamQuery=t.value;state.rosterPage=1;const route=state.route;const holder=$('#team-roster-list');if(holder&&route.page==='team'){const roster=state.officialRosters.get(String(route.params[2]||''));if(roster){const rows=roster.filter(p=>(state.teamPosition==='ALL'||p.position===state.teamPosition)&&(!state.teamQuery||p.name.toLowerCase().includes(state.teamQuery.toLowerCase())));holder.innerHTML=renderOfficialRosterRows(rows);return;}}if(holder&&['team','league'].includes(route.page)){const name=route.params[0]||'';const baseRows=route.page==='team'?playersForClubName(name):(dataIndex.playersByLeague.get(name)||[]);const rows=baseRows.filter(p=>(state.teamPosition==='ALL'||p.position===state.teamPosition||(p.secondaryPositions||[]).includes(state.teamPosition))&&(!state.teamQuery||p.displayName.toLowerCase().includes(state.teamQuery.toLowerCase())));state.rosterPage=Math.min(Math.max(1,state.rosterPage),Math.max(1,Math.ceil(rows.length/state.rosterPageSize)));const start=(state.rosterPage-1)*state.rosterPageSize;holder.innerHTML=renderRosterRows(rows.slice(start,start+state.rosterPageSize));const oldPager=holder.nextElementSibling;if(oldPager?.classList.contains('entity-pager'))oldPager.remove();holder.insertAdjacentHTML('afterend',renderRosterPager(rows.length));}}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='global-search-form'){e.preventDefault();state.filters.q=$('#global-search').value;state.page=1;go('search');}
    if(e.target.id==='hero-search-form'){e.preventDefault();state.filters=defaultFilters();state.filters.q=$('#hero-search').value;state.page=1;go('search');}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closePicker();if(e.key==='Enter'&&e.target.id==='picker-search'){e.preventDefault();const first=$('#picker-list [data-assign-player]');first?.click();}});
  window.addEventListener('hashchange',render);
  applyBundledTeamCatalog();
  render();
  window.__PITCHLAB_APP_READY__ = true;
   async function normalizeSavedInBatches(saved){const out=[];const batchSize=500;for(let start=0;start<saved.length;start+=batchSize){const end=Math.min(start+batchSize,saved.length);for(let i=start;i<end;i++)out.push(normalizePlayer(saved[i],i));if(saved.length>batchSize)await yieldToBrowser();}return out;}
   function normalizePesmasterSearchPlayer(raw,index){const id=String(raw.id),base='https://www.pesmaster.com',officialTeam=raw.team_id?state.officialTeamsById.get(String(raw.team_id)):null;const imagePath=String(raw.image||''),imageId=imagePath.match(/\/player_(\d+)\.png$/i)?.[1]||id,hasExactImage=/^\/pes-2021(?:-mobile)?\/graphics\/players\/player_\d+\.png$/i.test(imagePath),desktopImagePath=imagePath.replace('/pes-2021-mobile/','/pes-2021/');const attr={dribbling:raw.dribbling,lowPass:raw.low_pass,finishing:raw.finishing,defensiveAwareness:raw.defensive_awareness,speed:raw.speed,balance:raw.body_balance};return normalizePlayer({id:`pesmaster-${id}-${index}`,pesmasterPlayerId:id,catalogVersion:window.PITCHLAB_BUILD_ID,name:raw.name,displayName:raw.name_display||raw.name,position:raw.pos,overall:raw.ovr,potential:raw.pot,age:raw.age,height:raw.height,nationality:raw.nat_name||raw.nat||'Unknown',club:raw.team_name||officialTeam?.name||'Unassigned',league:officialTeam?.leagues?.[0]?.name||officialTeam?.league||'Unassigned',teamId:raw.team_id||officialTeam?.teamId||'',portraitId:imageId,portraitSource:'pesmaster',portraitUrl:hasExactImage?new URL(desktopImagePath,base).href:`${base}/pes-2021/graphics/players/player_${imageId}.png`,portraitFallbackUrl:`${base}/pes-2021/graphics/players/player_${imageId}.png`,teamLogoUrl:raw.image_team&&raw.team_id?base+raw.image_team:'',flagUrl:raw.image_country?base+raw.image_country:'',sourceUrl:raw.url?new URL(raw.url,base).href:'',sourceName:'PESMASTER PES 2021 Advanced Search',dataStatus:'AUTHENTIC',attributes:attr},index);}
   async function normalizePesmasterSearchCatalog(rows){const out=[];const batchSize=500;for(let start=0;start<rows.length;start+=batchSize){const end=Math.min(start+batchSize,rows.length);for(let i=start;i<end;i++)out.push(normalizePesmasterSearchPlayer(rows[i],i));if(rows.length>batchSize){setProgress('parse',Math.min(88,80+Math.round(end/rows.length*8)),`Preparing PESMASTER records ${end.toLocaleString()} / ${rows.length.toLocaleString()}`);await yieldToBrowser();}}return out;}
    async function restorePesmasterPlayerCatalog(){try{state.fullDatabaseLoading=true;state.fullDatabaseStatus='loading';render();const rows=await fetchJsonRowsInWorker(`${location.origin}/data/pesmaster-players.json?v=2026-10-17-pesmaster-player-catalog-3`);const players=await normalizePesmasterSearchCatalog(rows);state.players=players;state.imported=false;state.fullDatabaseLoading=false;state.fullDatabaseStatus='loaded';state.selectedIds.clear();state.filters=defaultFilters();await rebuildDataIndexes();localStorage.removeItem(STORAGE_PLAYERS);await clearLargePlayers();await saveActivePlayers(state.players);render();notify(`Restored ${state.players.length.toLocaleString()} PESMASTER player records.`);}catch(error){state.fullDatabaseLoading=false;state.fullDatabaseStatus='failed';state.fullDatabaseError=String(error.message||error);render();notify('Could not restore the PESMASTER player catalogue.');}}
  async function loadPesmasterPlayerCatalog(){
    if(state.players.length>=1000)return;
    if(state.playerCatalogPromise)return state.playerCatalogPromise;
    state.fullDatabaseLoading=true;state.fullDatabaseStatus='loading';state.fullDatabaseError='';render();setProgress('download',0,'Loading PESMASTER players for this section');
    const task=(async()=>{try{
      let saved=null;try{saved=await readLargePlayers();}catch(error){console.info('No player cache is available; loading the bundled catalogue.',error);}
      const savedIsOfficial=Array.isArray(saved)&&saved[0]?.sourceName==='PESMASTER PES 2021 Advanced Search';
      const cacheIsCurrent=savedIsOfficial&&saved.length===28755&&saved[0]?.catalogVersion===window.PITCHLAB_BUILD_ID;
      if(Array.isArray(saved)&&saved.length>=1000&&!savedIsOfficial){
        state.players=await normalizeSavedInBatches(saved);state.imported=true;
      }else if(cacheIsCurrent){
        state.players=await normalizeSavedInBatches(saved);state.imported=false;
      }else{
        let officialRows=window.PITCHLAB_PESMASTER_SEARCH_PLAYERS;
        if(!Array.isArray(officialRows)||!officialRows.length)officialRows=await fetchJsonRowsInWorker(`${location.origin}/data/pesmaster-players.json?v=2026-10-17-pesmaster-player-catalog-3`);
        state.players=await normalizePesmasterSearchCatalog(officialRows);state.imported=false;
      }
      setProgress('parse',90,'Indexing player records for this section');state.fullDatabaseError='';await rebuildDataIndexes();state.fullDatabaseLoading=false;state.fullDatabaseStatus='loaded';render();setProgress('done',100,`${state.players.length.toLocaleString()} PESMASTER player records loaded`);
      if(!cacheIsCurrent&&!state.imported)saveActivePlayers(state.players).then(storage=>console.info(`Saved player catalogue in ${storage}.`)).catch(error=>console.warn('PESMASTER catalogue remains available from the bundled file.',error));
    }catch(error){state.fullDatabaseLoading=false;state.fullDatabaseStatus='failed';state.fullDatabaseError=String(error.message||error);render();setProgress('error',0,`Player catalogue failed: ${state.fullDatabaseError}`);console.warn('PitchLab PESMASTER player catalogue load failed:',error);}})();
    state.playerCatalogPromise=task;try{await task;}finally{state.playerCatalogPromise=null;}
  }
})();
