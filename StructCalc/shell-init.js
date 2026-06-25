/* =====================================================================
   StructCalc — shell-init.js
   Responsibility: application startup — render initial dashboard,
                   set user avatar initials.
   Depends on: projects.js, dashboard.js, workspace.js, wind-workspace.js
   Rule: only touch when adding/removing global startup side-effects.
   ===================================================================== */

renderDashboard();

var _initials = 'SO';
document.getElementById('dbAvatar').textContent = _initials;
document.getElementById('wsAvatar').textContent = _initials;
