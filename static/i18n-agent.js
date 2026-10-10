/* StormCard agent trace strings (kre, es, en). Merged into SC.strings. */
(function () {
  "use strict";
  if (!window.SC || !window.SC.strings) return;
  var A = {
    kre: {
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
  Object.keys(A).forEach(function (l) {
    var t = window.SC.strings[l] || (window.SC.strings[l] = {});
    Object.keys(A[l]).forEach(function (k) { t[k] = A[l][k]; });
  });
})();
