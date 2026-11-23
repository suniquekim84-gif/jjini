/* 찌니 대시보드 — 독서 기록
   책 제목과 짧은 감상평을 날짜와 함께 기기 localStorage 에 저장합니다. */
(function () {
  'use strict';

  var KEY = 'jjini.books.v1';

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 용량 초과 등 */ }
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (it) { return it && it.title; });
    } catch (e) {
      return [];
    }
  }

  function byNewest(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  function uid() {
    return 'book' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  window.FamilyBooks = {
    KEY: KEY,

    list: function () {
      return read().sort(byNewest);
    },

    get: function (id) {
      var list = read();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    add: function (o) {
      var list = read();
      var title = String(o.title || '').trim().slice(0, 60);
      if (!title) return null;
      var item = {
        id: uid(),
        date: String(o.date || '').slice(0, 10),
        title: title,
        review: String(o.review || '').trim().slice(0, 400),
        createdAt: Date.now()
      };
      list.push(item);
      write(list);
      return item;
    },

    update: function (id, o) {
      var list = read();
      var found = null;
      list.forEach(function (it) {
        if (it.id !== id) return;
        if (o.date) it.date = String(o.date).slice(0, 10);
        if (typeof o.title === 'string' && o.title.trim()) it.title = o.title.trim().slice(0, 60);
        if (typeof o.review === 'string') it.review = o.review.trim().slice(0, 400);
        found = it;
      });
      write(list);
      return found;
    },

    remove: function (id) {
      var list = read();
      var removed = null;
      var next = list.filter(function (it) {
        if (it.id === id) { removed = it; return false; }
        return true;
      });
      write(next);
      return removed;
    },

    restore: function (item) {
      if (!item) return;
      var list = read();
      list.push(item);
      write(list);
    }
  };
})();
