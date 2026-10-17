/* PES 2021 coach and tactical presets curated from linked public profile pages.
   Numerical values absent from those pages intentionally remain null. */
window.PITCHLAB_COACHES = [
  {
    id:'klopp', realName:'Jürgen Klopp', gameName:'G. Zeitzler (J. Klopp)', rating:92,
    team:'Liverpool', league:'English League', nationality:'Germany', formation:'4-3-3', adaptability:92, managementSkills:920,
    sourceUrl:'https://www.pesmaster.com/g-zeitzler/pes-2021/coach/362895/', sourceLabel:'PESMASTER · G. Zeitzler (J. Klopp)',
    lineup:[['GK'],['LB','CB','CB','RB'],['DMF','CMF','CMF'],['LWF','CF','RWF']],
    attack:{style:'Possession Game',buildUp:'Short-pass',area:'Centre',positioning:'Flexible',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Middle',pressuring:'Aggressive',defensiveLine:null,compactness:null},
    /* Custom values supplied by the user, not claimed to be the original hidden PESMASTER defaults. */
    tacticalPresets:{
      attacking:{supportRange:6,defensiveLine:9,compactness:2,advancedInstructions:[]},
      defensive:{supportRange:7,defensiveLine:8,compactness:3,advancedInstructions:[]}
    }
  },
  {
    id:'guardiola', realName:'Pep Guardiola', gameName:'L. Roman (P. Guardiola)', rating:92,
    team:'Manchester City', league:'English League', nationality:'Spain', formation:'4-3-3', adaptability:92, managementSkills:920,
    sourceUrl:'https://www.pesmaster.com/l-roman/pes-2021/coach/262360/', sourceLabel:'PESMASTER · L. Roman (P. Guardiola)',
    lineup:[['GK'],['LB','CB','CB','RB'],['DMF','CMF','CMF'],['LWF','CF','RWF']],
    attack:{style:'Possession Game',buildUp:'Short-pass',area:'Centre',positioning:'Flexible',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Middle',pressuring:'Aggressive',defensiveLine:null,compactness:null}
  },
  {
    id:'simeone', realName:'Diego Simeone', gameName:'C. Valbuena (D. Simeone)', rating:88,
    team:'Atlético de Madrid', league:'Spanish League', nationality:'Argentina', formation:'3-3-2-2', adaptability:88, managementSkills:880,
    sourceUrl:'https://www.pesmaster.com/c-valbuena/pes-2021/coach/262196/', sourceLabel:'PESMASTER · C. Valbuena (D. Simeone)',
    lineup:[['GK'],['CB','CB','CB'],['DMF','CMF','CMF'],['LMF','RMF'],['SS','CF']],
    attack:{style:'Counter Attack',buildUp:'Short-pass',area:'Centre',positioning:'Maintain Formation',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Middle',pressuring:'Aggressive',defensiveLine:null,compactness:null}
  },
  {
    id:'conte', realName:'Antonio Conte', gameName:'G. Ripa (A. Conte)', rating:87,
    team:'Inter', league:'Serie A TIM', nationality:'Italy', formation:'3-3-2-2', adaptability:87, managementSkills:870,
    sourceUrl:'https://www.pesmaster.com/g-ripa/pes-2021/coach/262250/', sourceLabel:'PESMASTER · G. Ripa (A. Conte)',
    lineup:[['GK'],['CB','CB','CB'],['CMF','CMF','CMF'],['LMF','RMF'],['CF','CF']],
    attack:{style:'Possession Game',buildUp:'Short-pass',area:'Wide',positioning:'Maintain Formation',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Middle',pressuring:'Aggressive',defensiveLine:null,compactness:null}
  },
  {
    id:'pochettino', realName:'Mauricio Pochettino', gameName:'F. Cudoreni (Pochettino)', rating:87,
    team:'PSG', league:'Ligue 1 Conforama', nationality:'Argentina', formation:'4-3-3', adaptability:87, managementSkills:870,
    sourceUrl:'https://www.pesmaster.com/f-cudoreni/pes-2021/coach/262236/', sourceLabel:'PESMASTER · F. Cudoreni (Pochettino)',
    lineup:[['GK'],['LB','CB','CB','RB'],['DMF','CMF','CMF'],['LWF','CF','RWF']],
    attack:{style:'Possession Game',buildUp:'Short-pass',area:'Centre',positioning:'Flexible',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Wide',pressuring:'Aggressive',defensiveLine:null,compactness:null}
  },
  {
    id:'tuchel', realName:'Thomas Tuchel', gameName:'M. Preuss (T. Tuchel)', rating:86,
    team:'Chelsea', league:'English League', nationality:'Germany', formation:'5-2-3', adaptability:86, managementSkills:860,
    sourceUrl:'https://www.pesmaster.com/m-preuss/pes-2021/coach/362962/', sourceLabel:'PESMASTER · M. Preuss (T. Tuchel)',
    lineup:[['GK'],['CB','CB','CB'],['LB','RB'],['CMF','CMF'],['LWF','CF','RWF']],
    attack:{style:'Possession Game',buildUp:'Short-pass',area:'Centre',positioning:'Flexible',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Middle',pressuring:'Aggressive',defensiveLine:null,compactness:null}
  },
  {
    id:'fonseca', realName:'Paulo Fonseca', gameName:'Paulo Fonseca', rating:82,
    team:'Roma', league:'Serie A TIM', nationality:'Portugal', formation:'3-2-4-1', adaptability:82, managementSkills:820,
    sourceUrl:'https://www.pesmaster.com/paulo-fonseca/pes-2021/coach/297/', sourceLabel:'PESMASTER · Paulo Fonseca',
    lineup:[['GK'],['CB','CB','CB'],['CMF','CMF'],['LMF','AMF','AMF','RMF'],['CF']],
    attack:{style:'Possession Game',buildUp:'Short-pass',area:'Wide',positioning:'Flexible',supportRange:null},
    defense:{style:'Frontline Pressure',containment:'Wide',pressuring:'Conservative',defensiveLine:null,compactness:null}
  }
];
window.PITCHLAB_TEAM_TACTICS = window.PITCHLAB_COACHES.map(c => ({
  id:c.id, team:c.team, league:c.league, coachId:c.id, formation:c.formation,
  sourceUrl:c.sourceUrl, sourceLabel:c.sourceLabel,
  shortName:`${c.formation} · ${c.attack.style} · ${c.defense.pressuring} pressure`
}));
