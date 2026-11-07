// The browser remembers the ids of the reports it has opened, only here, so
// "Compare my ideas" works without accounts. Nothing is sent anywhere until
// the comparison page asks for them.
(function () {
  const KEY = "idea-check-mine";
  const MAX = 12;
  const valid = (id) => /^[0-9a-f-]{36}$/i.test(id);
  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list.filter(valid) : [];
    } catch {
      return [];
    }
  }
  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
      // Private mode: the list simply is not kept.
    }
  }
  window.Mine = {
    ids: read,
    valid,
    add(id) {
      if (valid(id)) write([id, ...read().filter((x) => x !== id)]);
    },
    remove(id) {
      write(read().filter((x) => x !== id));
    },
  };
})();
