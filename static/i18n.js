/* StormCard i18n + shared state. Every visible string exists in kre, es, en. */
(function () {
  "use strict";

  var S = {
    kre: {
      srcZones: "Zòn yo (Miami-Dade)",
      srcShelters: "Abri yo (done egzanp)",
      sec_what_this_means: "Sa sa vle di",
      sec_where_to_go: "Kote pou ale",
      sec_what_to_bring: "Kisa pou pote",
      sec_what_to_do_now: "Kisa pou fè kounye a",
      appName: "StormCard",
      skip: "Ale nan kontni a",
      back: "Retounen",
      langSwitch: "Lang",
      step: "Etap {n} sou 3",
      langTitle: "Chwazi lang ou",
      langHint: "Peze sou yon bouton pou kòmanse.",
      openSaved: "Louvri kat mwen ki sove a",
      savedOn: "Sove {date}",
      placeTitle: "Kote ou rete?",
      placeHint: "Chwazi kote ki pi pre ou.",
      useLoc: "Itilize kote mwen ye a",
      locating: "N ap chèche kote ou ye…",
      locErr: "Nou pa t ka jwenn kote ou ye. Chwazi yon kote anwo a.",
      householdTitle: "Ki moun ki avè w?",
      householdHint: "Peze sou tout sa ki rive ou.",
      pet: "Bèt kay",
      nocar: "Pa gen machin",
      medical: "Bezwen medikal",
      kids: "Timoun",
      selected: "chwazi",
      notSelected: "pa chwazi",
      makeCard: "Fè kat mwen",
      loadingTitle: "Gemma ap ekri kat ou…",
      loadingHint: "Zòn ou ak abri yo ap prepare. Sa ka pran jiska yon minit.",
      loadingSlow: "Sa pran plis tan lè modèl la sou òdinatè a. Tanpri rete la.",
      cancel: "Anile",
      errTitle: "Nou pa t ka fè kat ou.",
      errBody: "Verifye koneksyon ou epi eseye ankò.",
      errOutside: "StormCard kouvri Miami-Dade sèlman. Chwazi yon kote nan Miami-Dade, oswa rele 311.",
      retry: "Eseye ankò",
      zoneWord: "ZÒN",
      outside: "Deyò zòn inondasyon tanpèt",
      zoneNote: "Sa a se zòn inondasyon tanpèt ou. Se pa zòn asirans inondasyon ou.",
      outsideNote: "Ou deyò zòn inondasyon tanpèt konte a. Swiv lòd ofisyèl yo toujou.",
      chartTitle: "Kat ou",
      chartAria: "Kat ki montre lakay ou ak {n} abri",
      home: "LAKAY OU",
      sheltersTitle: "Abri tou pre ou",
      sample: "done egzanp",
      noShelters: "Pa gen abri ki matche nan done egzanp nou yo. Rele 311.",
      tapHint: "Peze sou yon abri pou wè wout li a.",
      petOk: "bèt kay OK",
      petUnknown: "pa konfime pou bèt kay",
      petNo: "pa gen bèt kay",
      call311: "Rele 311 pou konfime l louvri",
      medTitle: "Bezwen medikal",
      medHint: "Peze sou chak bagay lè w fini ak li. Sa sove sou telefòn sa a.",
      ck_meds7: "Medikaman pou 7 jou",
      ck_medlist: "Yon lis medikaman ou ekri sou papye",
      ck_rx: "Òdonans oswa kopi yo",
      ck_devices: "Aparèy medikal ak chajè yo",
      ck_power: "Plan pou kouran oswa oksijèn",
      ck_id: "ID ak kat asirans",
      eeapH: "Èd pou evakye: EEAP",
      eeapWhat: "Pwogram Asistans pou Ijans ak Evakyasyon Miami-Dade la bay transpò, yon abri an sekirite ak swen medikal pou moun ki pa ka pati poukont yo.",
      eeapCall: "Rele 311 pou enskri",
      eeapSrc: "Paj EEAP, Miami-Dade",
      snH: "Abri pou bezwen espesyal: enskri anvan",
      snNote: "Pou planifye sèlman. Ou dwe enskri anvan ou ale. Rele 311 pou konfime.",
      petH: "Bèt kay",
      petSupplies: "Manje, kòd ak kaj pou bèt la. Papye vaksen ak rabi. Chen bezwen lisans Miami-Dade.",
      petOk: "Abri tou pre w ki konfime yo aksepte bèt:",
      petNone: "Pa gen okenn abri tou pre w ki konfime yo aksepte bèt. Rele 311 anvan ou ale.",
      carH: "Pa gen machin",
      carText: "Bis ijans yo pati nan kote ki make yo pou ale nan abri yo. Rele 311 pou jwenn sa ki pi pre w la.",
      carCall: "Rele 311 pou yon woulib",
      kidsH: "Timoun",
      kids1: "Ti manje, dlo ak yon jwèt yo renmen",
      kids2: "Kouchèt, lenj mouye, lèt ak bibwon",
      kids3: "Medikaman ak papye lekòl oswa ID",
      kids4: "Yon kat ak nimewo telefòn ou pou chak timoun",
      sn_tag: "Bezwen espesyal",
      mi: "mi",
      routeTo: "Wout pou ale nan abri {n}",
      cardTitle: "Kat ou",
      makeAgain: "Fè l ankò an {lang}",
      cardSaved: "Kat sa a sove sou aparèy sa a.",
      askBtn: "Poze yon kesyon",
      askTitle: "Poze yon kesyon",
      askHint: "Nou reponn selon kat ou a sèlman.",
      askLabel: "Kesyon ou",
      askPlaceholder: "Ekri kesyon ou la a",
      send: "Voye",
      chipsLabel: "Kesyon ki souvan poze",
      chip1: "Èske m ka pote manje chen mwen?",
      chip2: "E si abri a plen?",
      chip3: "Mwen pa gen machin. Kisa m dwe fè?",
      offlineSwitch: "Mòd san entènèt",
      offlineHint: "Sèvi ak modèl ki sou òdinatè a sèlman.",
      thinking: "Gemma ap reponn…",
      askErr: "Nou pa t ka jwenn yon repons. Eseye ankò.",
      you: "Ou",
      answer: "Repons",
      how: "Ki jan nou deside",
      howZone: "Zòn",
      howShelters: "Abri",
      howFlags: "Kay ou",
      howNone: "anyen chwazi",
      sources: "Sous yo",
      b_gemini: "Gemini API · Gemma 4",
      b_ollama: "Gemma 4 lokal · san entènèt",
      b_none: "Se fè sèlman · AI pa disponib",
      CALL_311: "Rele 311 pou konfime yon abri louvri anvan ou ale.",
      langNative: "Kreyòl"
    },
    es: {
      srcZones: "Zonas (Miami-Dade)",
      srcShelters: "Refugios (datos de muestra)",
      sec_what_this_means: "Qué significa esto",
      sec_where_to_go: "Adónde ir",
      sec_what_to_bring: "Qué llevar",
      sec_what_to_do_now: "Qué hacer ahora",
      appName: "StormCard",
      skip: "Ir al contenido",
      back: "Atrás",
      langSwitch: "Idioma",
      step: "Paso {n} de 3",
      langTitle: "Elija su idioma",
      langHint: "Toque un botón para empezar.",
      openSaved: "Abrir mi tarjeta guardada",
      savedOn: "Guardada {date}",
      placeTitle: "¿Dónde vive?",
      placeHint: "Elija el lugar más cercano.",
      useLoc: "Usar mi ubicación",
      locating: "Buscando su ubicación…",
      locErr: "No pudimos encontrar su ubicación. Elija un lugar arriba.",
      householdTitle: "¿Quién está con usted?",
      householdHint: "Toque todo lo que le corresponda.",
      pet: "Mascota",
      nocar: "Sin carro",
      medical: "Necesidades médicas",
      kids: "Niños",
      selected: "seleccionado",
      notSelected: "no seleccionado",
      makeCard: "Crear mi tarjeta",
      loadingTitle: "Gemma está escribiendo su tarjeta…",
      loadingHint: "Su zona y los refugios ya están listos. Puede tardar hasta un minuto.",
      loadingSlow: "Tarda más cuando el modelo corre en la computadora. Por favor espere.",
      cancel: "Cancelar",
      errTitle: "No pudimos crear su tarjeta.",
      errBody: "Revise su conexión e intente de nuevo.",
      errOutside: "StormCard solo cubre el condado de Miami-Dade. Elija un lugar en Miami-Dade o llame al 311.",
      retry: "Intentar de nuevo",
      zoneWord: "ZONA",
      outside: "Fuera de las zonas de marea de tormenta",
      zoneNote: "Esta es su zona de marea de tormenta. No es su zona del seguro contra inundaciones.",
      outsideNote: "Está fuera de las zonas de marea de tormenta del condado. Siga siempre las órdenes oficiales.",
      chartTitle: "Su mapa",
      chartAria: "Mapa de su casa y {n} refugios",
      home: "SU CASA",
      sheltersTitle: "Refugios cerca de usted",
      sample: "datos de muestra",
      noShelters: "No hay refugios que coincidan en nuestros datos de muestra. Llame al 311.",
      tapHint: "Toque un refugio para ver su ruta.",
      petOk: "mascotas OK",
      petUnknown: "mascotas sin confirmar",
      petNo: "sin mascotas",
      call311: "Llame al 311 para confirmar que está abierto",
      medTitle: "Necesidades médicas",
      medHint: "Toque cada cosa cuando esté lista. Se guarda en este teléfono.",
      ck_meds7: "Medicinas para 7 días",
      ck_medlist: "Lista escrita de sus medicamentos",
      ck_rx: "Recetas o copias",
      ck_devices: "Equipos médicos y cargadores",
      ck_power: "Plan de energía u oxígeno",
      ck_id: "Identificación y tarjeta del seguro",
      eeapH: "Ayuda para evacuar: EEAP",
      eeapWhat: "El Programa de Asistencia de Emergencia y Evacuación de Miami-Dade ofrece transporte, un refugio seguro y control médico a quienes no pueden salir solos.",
      eeapCall: "Llame al 311 para inscribirse",
      eeapSrc: "Página del EEAP, Miami-Dade",
      snH: "Refugio para necesidades especiales: inscríbase primero",
      snNote: "Solo para planear. Debe inscribirse antes de ir. Llame al 311 para confirmar.",
      petH: "Mascotas",
      petSupplies: "Comida, correa y transportadora. Papeles de vacunas y rabia. Los perros necesitan licencia de Miami-Dade.",
      petOk: "Confirmados para mascotas cerca de usted:",
      petNone: "Ningún refugio cercano está confirmado para mascotas. Llame al 311 antes de ir.",
      carH: "Sin carro",
      carText: "Los autobuses de emergencia salen de puntos marcados hacia los refugios. Llame al 311 para el más cercano.",
      carCall: "Llame al 311 para transporte",
      kidsH: "Niños",
      kids1: "Meriendas, agua y un juguete favorito",
      kids2: "Pañales, toallitas, fórmula y biberones",
      kids3: "Medicinas y documentos de la escuela o identificación",
      kids4: "Una tarjeta con su teléfono para cada niño",
      sn_tag: "Necesidades especiales",
      mi: "mi",
      routeTo: "Ruta al refugio {n}",
      cardTitle: "Su tarjeta",
      makeAgain: "Crearla de nuevo en {lang}",
      cardSaved: "Esta tarjeta está guardada en este dispositivo.",
      askBtn: "Hacer una pregunta",
      askTitle: "Haga una pregunta",
      askHint: "Respondemos solo con lo que dice su tarjeta.",
      askLabel: "Su pregunta",
      askPlaceholder: "Escriba su pregunta aquí",
      send: "Enviar",
      chipsLabel: "Preguntas frecuentes",
      chip1: "¿Puedo llevar la comida de mi perro?",
      chip2: "¿Y si el refugio está lleno?",
      chip3: "No tengo carro. ¿Qué hago?",
      offlineSwitch: "Forzar sin internet",
      offlineHint: "Usa solo el modelo de esta computadora.",
      thinking: "Gemma está respondiendo…",
      askErr: "No pudimos obtener una respuesta. Intente de nuevo.",
      you: "Usted",
      answer: "Respuesta",
      how: "Cómo lo decidimos",
      howZone: "Zona",
      howShelters: "Refugios",
      howFlags: "Su hogar",
      howNone: "nada seleccionado",
      sources: "Fuentes",
      b_gemini: "Gemini API · Gemma 4",
      b_ollama: "Gemma 4 local · sin internet",
      b_none: "Solo datos · IA no disponible",
      CALL_311: "Llame al 311 para confirmar que un refugio está abierto antes de ir.",
      langNative: "Español"
    },
    en: {
      srcZones: "Surge zones (Miami-Dade)",
      srcShelters: "Shelters (sample data)",
      sec_what_this_means: "What this means",
      sec_where_to_go: "Where to go",
      sec_what_to_bring: "What to bring",
      sec_what_to_do_now: "What to do now",
      appName: "StormCard",
      skip: "Skip to content",
      back: "Back",
      langSwitch: "Language",
      step: "Step {n} of 3",
      langTitle: "Choose your language",
      langHint: "Tap a button to start.",
      openSaved: "Open my saved card",
      savedOn: "Saved {date}",
      placeTitle: "Where do you live?",
      placeHint: "Pick the closest place.",
      useLoc: "Use my location",
      locating: "Finding your location…",
      locErr: "We could not find your location. Pick a place above instead.",
      householdTitle: "Who is with you?",
      householdHint: "Tap everything that fits.",
      pet: "Pet",
      nocar: "No car",
      medical: "Medical needs",
      kids: "Kids",
      selected: "selected",
      notSelected: "not selected",
      makeCard: "Make my card",
      loadingTitle: "Gemma is writing your card…",
      loadingHint: "Your zone and shelters are ready. This can take up to a minute.",
      loadingSlow: "It takes longer when the model runs on the laptop. Please stay on this page.",
      cancel: "Cancel",
      errTitle: "We could not make your card.",
      errBody: "Check your connection and try again.",
      errOutside: "StormCard only covers Miami-Dade County. Pick a place in Miami-Dade, or call 311.",
      retry: "Try again",
      zoneWord: "ZONE",
      outside: "Outside storm surge zones",
      zoneNote: "This is your storm surge zone. It is not your flood-insurance zone.",
      outsideNote: "You are outside the county's storm surge zones. Still follow official orders.",
      chartTitle: "Your map",
      chartAria: "Map of your home and {n} shelters",
      home: "YOUR HOME",
      sheltersTitle: "Shelters near you",
      sample: "sample data",
      noShelters: "No matching shelter in our sample data. Call 311.",
      tapHint: "Tap a shelter to see its route.",
      petOk: "pets OK",
      petUnknown: "pets not confirmed",
      petNo: "no pets",
      call311: "Call 311 to confirm it's open",
      medTitle: "Medical needs",
      medHint: "Tap each item when it is done. Your ticks are saved on this phone.",
      ck_meds7: "7 days of medicine",
      ck_medlist: "A written list of your medications",
      ck_rx: "Prescriptions or copies",
      ck_devices: "Medical devices and chargers",
      ck_power: "Plan for power or oxygen",
      ck_id: "ID and insurance card",
      eeapH: "Help to evacuate: EEAP",
      eeapWhat: "Miami-Dade's Emergency and Evacuation Assistance Program gives transport, a safe shelter and medical checks to people who cannot leave on their own.",
      eeapCall: "Call 311 to register",
      eeapSrc: "EEAP page, Miami-Dade",
      snH: "Special-needs shelter: register first",
      snNote: "Planning only. You must register before you go. Call 311 to confirm.",
      petH: "Pets",
      petSupplies: "Pet food, leash and carrier. Vaccine and rabies papers. Dogs need a Miami-Dade license.",
      petOk: "Confirmed pet-friendly near you:",
      petNone: "No shelter near you is confirmed pet-friendly. Call 311 before you go.",
      carH: "No car",
      carText: "Emergency buses run from marked pickup sites to shelters. Call 311 to find the nearest one.",
      carCall: "Call 311 for a ride",
      kidsH: "Kids",
      kids1: "Snacks, water and a favorite toy",
      kids2: "Diapers, wipes, formula and bottles",
      kids3: "Medicine and school or ID papers",
      kids4: "A card with your phone number for each child",
      sn_tag: "Special needs",
      mi: "mi",
      routeTo: "Route to shelter {n}",
      cardTitle: "Your card",
      makeAgain: "Make it again in {lang}",
      cardSaved: "This card is saved on this device.",
      askBtn: "Ask a question",
      askTitle: "Ask a question",
      askHint: "We answer only from what your card says.",
      askLabel: "Your question",
      askPlaceholder: "Type your question here",
      send: "Send",
      chipsLabel: "Common questions",
      chip1: "Can I bring my dog's food?",
      chip2: "What if the shelter is full?",
      chip3: "I have no car. What do I do?",
      offlineSwitch: "Force offline",
      offlineHint: "Use only the model on this laptop.",
      thinking: "Gemma is answering…",
      askErr: "We could not get an answer. Try again.",
      you: "You",
      answer: "Answer",
      how: "How we decided",
      howZone: "Zone",
      howShelters: "Shelters",
      howFlags: "Household",
      howNone: "none selected",
      sources: "Sources",
      b_gemini: "Gemini API · Gemma 4",
      b_ollama: "Local Gemma 4 · offline",
      b_none: "Facts only · AI unavailable",
      CALL_311: "Call 311 to confirm a shelter is open before you go.",
      langNative: "English"
    }
  };

  var LOCALE = { kre: "fr-HT", es: "es-US", en: "en-US" };
  var HTML_LANG = { kre: "ht", es: "es", en: "en" };

  var SC = (window.SC = {
    strings: S,
    langs: ["kre", "es", "en"],
    state: {
      lang: "en",
      screen: "lang",
      home: null,
      flags: { pet: false, no_car: false, medical: false, kids: false },
      result: null,
      forceOffline: false
    },
    listeners: []
  });

  SC.t = function (key, vars) {
    var table = S[SC.state.lang] || S.en;
    var s = table[key];
    if (s === undefined) s = S.en[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace("{" + k + "}", vars[k]);
      });
    }
    return s;
  };

  SC.tl = function (lang, key) {
    return (S[lang] || S.en)[key] || S.en[key] || key;
  };

  SC.locale = function () { return LOCALE[SC.state.lang] || "en-US"; };

  SC.guessLang = function () {
    var n = (navigator.language || "en").toLowerCase();
    if (n.indexOf("ht") === 0) return "kre";
    if (n.indexOf("es") === 0) return "es";
    return "en";
  };

  SC.applyStatic = function () {
    document.documentElement.lang = HTML_LANG[SC.state.lang] || "en";
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      n.textContent = SC.t(n.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (n) {
      n.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":");
        if (p.length === 2) n.setAttribute(p[0].trim(), SC.t(p[1].trim()));
      });
    });
  };

  SC.setLang = function (lang) {
    if (!S[lang]) return;
    SC.state.lang = lang;
    SC.applyStatic();
    SC.listeners.forEach(function (fn) { try { fn(lang); } catch (e) { /* keep going */ } });
  };

  SC.onLang = function (fn) { SC.listeners.push(fn); };
  /* Shared UI helpers. setText turns every "311" into a tel:311 link (text stays textContent-safe). */
  SC.setText = function (node, text) {
    node.textContent = "";
    String(text === undefined || text === null ? "" : text).split(/(\b311\b)/).forEach(function (part) {
      if (part === "311") {
        var a = document.createElement("a");
        a.href = "tel:311";
        a.className = "tel";
        a.textContent = "311";
        node.appendChild(a);
      } else if (part) node.appendChild(document.createTextNode(part));
    });
    return node;
  };

  /* One trace row, used by the card stages and the Ask trace. state: done | run | fail */
  SC.stepRow = function (state, label, parts) {
    var NS = "http://www.w3.org/2000/svg";
    var li = document.createElement("li");
    li.className = "step is-" + state;
    var mk = document.createElement("span");
    mk.className = "mk";
    mk.setAttribute("aria-hidden", "true");
    if (state === "done") {
      var s = document.createElementNS(NS, "svg");
      s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", 16); s.setAttribute("height", 16);
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M5 12.5L10 17.5L19 7");
      s.appendChild(p); mk.appendChild(s);
    }
    li.appendChild(mk);
    var body = document.createElement("span");
    body.className = "sb";
    var l = document.createElement("span");
    l.className = "trace-tool";
    l.textContent = label;
    body.appendChild(l);
    (parts || []).forEach(function (n) { if (n) body.appendChild(n); });
    li.appendChild(body);
    return li;
  };
})();
