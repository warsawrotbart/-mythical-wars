/* MW v2.1K. Test-only hero art. Separate images, never baked HUD counters. */
(function(global){
  "use strict";
  const root="assets/hero-art-v2.1K/";
  const portraits=Object.freeze({
    "Чернокнижник":Object.freeze({day:root+"warlock_keeper_test.webp",night:root+"warlock_keeper_test.webp"}),
    "Воин":Object.freeze({day:root+"warrior_day_test.webp",night:root+"warrior_night_test.webp"})
  });
  const abilities=Object.freeze({
    "Чернокнижник":root+"warlock_ability_void_test.webp",
    "Воин":root+"warrior_ability_torch_test.webp"
  });
  global.MW_HERO_ART=Object.freeze({
    version:"v2.1K",status:"test",portraits,abilities,
    portraitFor(classId,phase="day"){
      const entry=portraits[classId];
      return entry?(phase==="night"?entry.night:entry.day):"";
    },
    abilityFor(classId){return abilities[classId]||"";}
  });
})(window);
