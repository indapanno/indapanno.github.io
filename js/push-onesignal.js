// Модуль поставщика OneSignal для страницы (ТЗ push_TZ.md, раздел 8).
// Общий интерфейс (его ждёт js/push.js):
//   status() → { subscribed: bool }
//   subscribe(lang, categories) — спросить разрешение, подписать, записать теги
//   unsubscribe()
//   setCategories(lang, categories) — обновить теги
// categories = { terms: bool, bundles: bool, publications: bool }.
// Теги поставщика: lang (ru|thai), c_terms / c_bundles / c_publications ('1'|'0'), tester ('1' — только у тестеров).
// SDK OneSignal грузится только при первом вызове (клик по колокольчику или «подписан» в этом браузере).
(function () {
  'use strict';
  var SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  var ready = null;

  function load() {
    if (ready) return ready;
    ready = new Promise(function (resolve, reject) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(function (OneSignal) {
        OneSignal.init({
          appId: window.PUSH_CONFIG.appId,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          autoResubscribe: true,
          notifyButton: { enable: false },
          welcomeNotification: { disable: true }
        }).then(function () { resolve(OneSignal); }, reject);
      });
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.defer = true;
      s.onerror = function () { ready = null; reject(new Error('sdk')); };
      document.head.appendChild(s);
      setTimeout(function () { reject(new Error('timeout')); }, 20000);
    });
    return ready;
  }

  function tags(lang, c) {
    var t = { lang: lang, c_terms: c.terms ? '1' : '0', c_bundles: c.bundles ? '1' : '0', c_publications: c.publications ? '1' : '0' };
    try { if (localStorage.getItem('push-tester') === '1') t.tester = '1'; } catch (e) { /* без хранилища — не тестер */ }
    return t;
  }

  window.PushProvider = {
    status: function () {
      return load().then(function (OneSignal) { return { subscribed: !!OneSignal.User.PushSubscription.optedIn }; });
    },
    subscribe: function (lang, categories) {
      return load().then(function (OneSignal) {
        return OneSignal.Notifications.requestPermission().then(function () {
          if (!OneSignal.Notifications.permission) throw new Error('denied');
          return OneSignal.User.PushSubscription.optIn();
        }).then(function () {
          return OneSignal.User.addTags(tags(lang, categories));
        });
      });
    },
    unsubscribe: function () {
      return load().then(function (OneSignal) { return OneSignal.User.PushSubscription.optOut(); });
    },
    setCategories: function (lang, categories) {
      return load().then(function (OneSignal) { return OneSignal.User.addTags(tags(lang, categories)); });
    }
  };
})();
