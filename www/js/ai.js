/* Muslim IA : questions envoyées à Anthropic avec VOTRE clé API. Rien n'est journalisé. */
(function (R) {
  'use strict';
  var SYSTEM = 'Tu es Muslim IA, un assistant de connaissances islamiques intégré à l\'application Rakeb. ' +
    'Réponds en français, avec bienveillance, clarté et concision. Appuie-toi sur le Coran et la Sunna authentique, ' +
    'cite les sources que tu connais avec certitude (sourate et verset, recueil de hadith), n\'invente jamais de hadith ni de verset, ' +
    'et signale honnêtement quand tu n\'es pas sûr. Présente les divergences entre les écoles juridiques quand elles existent. ' +
    'Pour les avis juridiques (fatwa) ou les situations personnelles délicates, rappelle qu\'il faut consulter un savant qualifié.';

  /** messages : [{role:'user'|'assistant', content:string}] — on n'envoie que les 10 derniers. */
  function ask(messages) {
    var s = R.store.settings(), key = R.store.get('apikey', '');
    if (!key) return Promise.reject(new Error('Ajoutez votre clé API dans Paramètres › Muslim IA.'));
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: s.model, max_tokens: 1000, system: SYSTEM, messages: messages.slice(-10) })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = r.status === 401 ? 'Clé API refusée. Vérifiez-la dans les paramètres.' :
                  r.status === 429 ? 'Trop de demandes. Réessayez dans un instant.' :
                  'Le service a répondu avec une erreur (' + r.status + ').';
          throw new Error(m);
        }
        return (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
      });
    }, function () { throw new Error('Impossible de joindre le service. Vérifiez votre connexion Internet.'); });
  }
  R.ai = { ask: ask };
})(window.R = window.R || {});
