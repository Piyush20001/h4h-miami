/* StormCard agent trace strings (kre, es, en). Merged into SC.strings. */
(function () {
  "use strict";
  if (!window.SC || !window.SC.strings) return;
  var A = {
    kre: {
      chip4: "Ekri fanmi m plan mwen", msgSend: "Voye tèks", msgCopy: "Kopye", msgCopied: "Kopye",
      tool_draft_message: "Ekri mesaj pou fanmi",
      traceTitle: "Kijan StormCard deside",
      traceNone: "Pa t gen okenn zouti ki rele.",
      tool_find_shelters: "Chèche abri ki pi pre",
      tool_get_zone: "Verifye zòn inondasyon",
      tool_packing_list: "Fè lis bagay pou pote",
      tool_lookup_guidance: "Chèche nan gid ofisyèl la",
      tool_evacuation_help: "Chèche èd evakyasyon",
      tool_fallback: "Repons dirèk (pa gen zouti)"
    },
    es: {
      chip4: "Enviar mi plan a mi familia", msgSend: "Enviar mensaje", msgCopy: "Copiar", msgCopied: "Copiado",
      tool_draft_message: "Redactar mensaje para la familia",
      traceTitle: "Cómo decidió StormCard",
      traceNone: "No se usó ninguna herramienta.",
      tool_find_shelters: "Buscar los refugios más cercanos",
      tool_get_zone: "Revisar la zona de inundación",
      tool_packing_list: "Armar la lista de qué llevar",
      tool_lookup_guidance: "Buscar en la guía oficial",
      tool_evacuation_help: "Buscar ayuda para evacuar",
      tool_fallback: "Respuesta directa (sin herramientas)"
    },
    en: {
      chip4: "Text my family my plan", msgSend: "Send text", msgCopy: "Copy", msgCopied: "Copied",
      tool_draft_message: "Draft a message for family",
      traceTitle: "How StormCard decided",
      traceNone: "No tools were used.",
      tool_find_shelters: "Find the nearest shelters",
      tool_get_zone: "Check the storm surge zone",
      tool_packing_list: "Build a packing list",
      tool_lookup_guidance: "Search the official guidance",
      tool_evacuation_help: "Look up evacuation help",
      tool_fallback: "Direct answer (no tools)"
    }
  };
  var U = {
    kre: {
      stZone: "Zòn {z}", stShelter1: "1 abri", stShelters: "{n} abri", stNoShel: "Pa gen abri ki matche",
      stWriting: "Gemma ap ekri kat ou…", stDone: "Kat ou pare",
      stFail: "Nou pa t ka ekri tèks la. Zòn ak abri yo anwo a bon toujou.",
      stTitle: "Kijan kat la fèt",
      sampleFoot: "Abri sa yo se done egzanp, se pa yon lis an dirèk.",
      call311Btn: "Rele 311", rPet: "bèt kay OK", rNear: "pi pre", rUnk: "bèt kay pa konfime",
      dirTo: "Direksyon pou abri {n}", askWait: "Kat la poko pare. Tann Gemma fini."
    },
    es: {
      stZone: "Zona {z}", stShelter1: "1 refugio", stShelters: "{n} refugios", stNoShel: "Ningún refugio coincide",
      stWriting: "Gemma está escribiendo su tarjeta…", stDone: "Su tarjeta está lista",
      stFail: "No pudimos escribir el texto. La zona y los refugios de arriba siguen siendo correctos.",
      stTitle: "Cómo se hizo la tarjeta",
      sampleFoot: "Estos refugios son datos de muestra, no una lista en vivo.",
      call311Btn: "Llamar 311", rPet: "mascotas OK", rNear: "más cerca", rUnk: "mascotas sin confirmar",
      dirTo: "Dirección al refugio {n}", askWait: "La tarjeta aún no está lista. Espere a Gemma."
    },
    en: {
      stZone: "Zone {z}", stShelter1: "1 shelter", stShelters: "{n} shelters", stNoShel: "No matching shelters",
      stWriting: "Gemma is writing your card…", stDone: "Card ready",
      stFail: "We could not write the text. The zone and shelters above are still correct.",
      stTitle: "How the card was made",
      sampleFoot: "These shelters are sample data, not a live list.",
      call311Btn: "Call 311", rPet: "pets OK", rNear: "closest", rUnk: "pets not confirmed",
      dirTo: "Direction to shelter {n}", askWait: "The card is not ready yet. Wait for Gemma."
    }
  };
  Object.keys(U).forEach(function (l) {
    Object.keys(U[l]).forEach(function (k) { A[l][k] = U[l][k]; });
  });
  Object.keys(A).forEach(function (l) {
    var t = window.SC.strings[l] || (window.SC.strings[l] = {});
    Object.keys(A[l]).forEach(function (k) { t[k] = A[l][k]; });
  });
})();
