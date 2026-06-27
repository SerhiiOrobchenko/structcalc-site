/* =====================================================================
   StructCalc — shell-init.js
   Responsibility: trace marker — confirms all 5 defer scripts loaded.
   Init is now in dashboard.js DOMContentLoaded handler which fires
   regardless of crashes in later scripts (workspace.js, wind-workspace.js).
   ===================================================================== */
console.log('[SC] shell-init.js reached — all defer scripts executed');
