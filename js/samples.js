/* ============================================================
   TOTOO AI — Demo samples
   Written in the register actually used on Facebook, TikTok and X
   in the Philippines: Tagalog, Taglish, and code-switched English.
   ============================================================ */

window.TotooSamples = [
  {
    id: 'viral-scandal',
    label: 'Viral scandal post',
    tone: 'fake',
    kind: 'text',
    text:
      'GRABE!!! Hindi kapani-paniwala ang nangyari sa Maynila ngayong gabi! ' +
      'Ayon sa isang source na hindi pinangalanan, may nahuli raw na malaking iskandalo ' +
      'sa gobyerno. Bistado na raw ang lahat!!! SHARE NA AGAD PARA MALAMAN NG LAHAT, ' +
      'baka bukas tinanggal na ito ng mga may kapangyarihan. Grabe talaga ang nangyayari ' +
      'sa bansa natin ngayon. Ipaalam sa lahat ng kakilala mo!'
  },
  {
    id: 'health-hoax',
    label: 'Health hoax',
    tone: 'fake',
    kind: 'text',
    text:
      'Bawal na raw ang kape! Ayon sa isang doktor na hindi pinangalanan, ang kape daw ay ' +
      'nagdudulot ng sakit sa puso at kidney. Totoo ba ito? Kumakalat na sa group chat namin. ' +
      'Delikado ito kaya ipaalam sa lahat ng kakilala mo, lalo na sa mga matatanda! ' +
      'Sabi ng isang netizen, tinago raw ito ng mga malalaking kumpanya ng kape.'
  },
  {
    id: 'death-hoax',
    label: 'Celebrity death hoax',
    tone: 'fake',
    kind: 'text',
    text:
      'PASABOG! Patay na raw ang sikat na aktor na si JM Rivera, ayon sa isang insider ' +
      'na malapit sa pamilya. Hindi pa raw ito nako-confirm ng management pero kumakalat ' +
      'na ang balita sa lahat ng grupo. Kuno ay may video pa ng pangyayari na tinatago ' +
      'ng network. Ayaw maniwala ng mga fans! Rest in peace daw. Share agad bago maglabas ' +
      'ng official statement.'
  },
  {
    id: 'pagasa',
    label: 'PAGASA advisory',
    tone: 'authentic',
    kind: 'text',
    text:
      'Ayon sa PAGASA, ang bagyong si Enteng ay huling namataan sa layong 120 kilometro ' +
      'silangan ng Catarman, Northern Samar nitong Nobyembre 12, 2026, alas-dos ng hapon. ' +
      'Taglay nito ang lakas ng hangin na 85 kph malapit sa gitna at pagbugsong umaabot ' +
      'sa 105 kph. Sa isang pahayag, sinabi ni Sec. Reyes ng NDRRMC na nakahanda na ang ' +
      'mga evacuation center sa mga apektadong lalawigan.'
  },
  {
    id: 'doh-bulletin',
    label: 'DOH dengue bulletin',
    tone: 'authentic',
    kind: 'text',
    text:
      'Inanunsyo ng Department of Health nitong Lunes, Nobyembre 10, 2026, na 1,245 bagong ' +
      'kaso ng dengue ang naitala sa buong bansa sa nakalipas na linggo. Ayon kay Dr. Elena ' +
      'Santos, tagapagsalita ng DOH, patuloy ang pagbabakuna at fogging operations sa mga ' +
      'lugar na may mataas na kaso. Hinikayat niya ang publiko na tanggalin ang stagnant ' +
      'water sa paligid ng tahanan.'
  },
  {
    id: 'community-alert',
    label: 'Community alert',
    tone: 'mixed',
    kind: 'text',
    text:
      'May nangyaring pananambang daw malapit sa barangay hall kagabi. Ayon sa isang ' +
      'netizen, may dalawang lalaki raw na tumakas sakay ng motorsiklo. Wala pang official ' +
      'statement ang PNP pero pinayuhan na raw ang mga residente na mag-ingat. Grabe ang ' +
      'takot ng mga kapitbahay namin ngayon! I-share para maalerto ang iba.'
  }
];

window.TotooSamples.byId = function (id) {
  return window.TotooSamples.filter(function (s) { return s.id === id; })[0] || null;
};
