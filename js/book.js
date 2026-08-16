(function () {
  var form = document.getElementById("bookingForm");
  var okBox = document.getElementById("okBox");
  var btn = document.getElementById("submitBtn");
  var errorBox = document.getElementById("formError");
  var grid = document.getElementById("calGrid");
  var label = document.getElementById("calLabel");
  var choice = document.getElementById("calChoice");
  var dateInput = document.getElementById("preferredDate");
  var weekInput = document.getElementById("preferredWeek");

  var pageLoadedAt = Date.now();
  var sending = false;
  var view = new Date();
  view.setDate(1);
  var selected = null;

  var MIN_FILL_MS = 4000;
  var COOLDOWN_MS = 10 * 60 * 1000;
  var MAX_PER_DAY = 3;
  var KEY = "sfa_form_log";

  function readLog() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { times: [], hashes: [] };
    } catch (e) {
      return { times: [], hashes: [] };
    }
  }

  function writeLog(log) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(log));
    } catch (e) {}
  }

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  function startOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function fmt(date) {
    return date.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function iso(date) {
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  }

  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.remove("show");
  }

  function render() {
    grid.innerHTML = "";
    label.textContent = view.toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric"
    });

    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var start = startOfWeek(first);
    var weekStart = selected ? startOfWeek(selected) : null;
    var weekEnd = weekStart ? addDays(weekStart, 6) : null;
    var now = today();

    for (var i = 0; i < 42; i++) {
      var day = addDays(start, i);
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = String(day.getDate());
      button.disabled = day < now;
      if (day.getMonth() !== view.getMonth()) button.style.opacity = "0.38";
      if (weekStart && day >= weekStart && day <= weekEnd) button.classList.add("in-week");
      if (selected && iso(day) === iso(selected)) button.classList.add("selected");
      button.addEventListener("click", selectDay.bind(null, new Date(day)));
      grid.appendChild(button);
    }
  }

  function selectDay(day) {
    selected = day;
    var weekStart = startOfWeek(day);
    var weekEnd = addDays(weekStart, 6);
    dateInput.value = iso(day);
    weekInput.value = fmt(weekStart) + " – " + fmt(weekEnd);
    choice.textContent = "Week of " + fmt(weekStart) + " · preferred day " + fmt(day);
    clearError();
    render();
  }

  document.getElementById("calPrev").addEventListener("click", function () {
    view.setMonth(view.getMonth() - 1);
    render();
  });

  document.getElementById("calNext").addEventListener("click", function () {
    view.setMonth(view.getMonth() + 1);
    render();
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (sending) return;
    clearError();

    var fname = document.getElementById("fname").value.trim();
    var email = document.getElementById("email").value.trim();
    var company = document.getElementById("company").value.trim();
    var size = document.getElementById("size").value.trim();
    var notes = document.getElementById("notes").value.trim();
    var flexible = document.getElementById("flexible").checked;

    if (!fname || !email || !company) {
      showError("Please add your name, company, and email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showError("Please enter a valid email address.");
      return;
    }
    if (!size || Number(size) < 5) {
      showError("Sessions need at least 5 people.");
      return;
    }
    if (!weekInput.value && !flexible) {
      showError("Select a week on the calendar, or mark the dates as flexible.");
      return;
    }
    if (!notes) {
      showError("Add a short note about the situation so Dylan can quote accurately.");
      return;
    }

    var hp = form.querySelector('[name="bot-field"]');
    if (hp && hp.value) {
      form.style.display = "none";
      okBox.classList.add("show");
      return;
    }

    if (Date.now() - pageLoadedAt < MIN_FILL_MS) {
      showError("Please take a moment to complete the form before submitting.");
      return;
    }

    var now = Date.now();
    var log = readLog();
    log.times = (log.times || []).filter(function (t) {
      return now - t < 86400000;
    });
    log.hashes = (log.hashes || []).slice(-10);

    if (log.times.length >= MAX_PER_DAY) {
      showError("You have already sent a few requests today. Email dylan@sfacademy.ca if it is urgent.");
      return;
    }

    var last = log.times[log.times.length - 1];
    if (last && now - last < COOLDOWN_MS) {
      var mins = Math.ceil((COOLDOWN_MS - (now - last)) / 60000);
      showError("Please wait about " + mins + " minute" + (mins === 1 ? "" : "s") + " before sending another request.");
      return;
    }

    var sig = hash((fname + "|" + email + "|" + company).toLowerCase());
    if (log.hashes.indexOf(sig) !== -1) {
      showError("It looks like this request was already sent. Dylan will be in touch.");
      return;
    }

    if (flexible && !weekInput.value) {
      weekInput.value = "Flexible";
      dateInput.value = "";
    }

    sending = true;
    btn.disabled = true;
    btn.textContent = "Sending...";

    log.times.push(now);
    log.hashes.push(sig);
    writeLog(log);

    var encoded = new URLSearchParams(new FormData(form)).toString();

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encoded
    })
      .then(function () {
        form.style.display = "none";
        okBox.classList.add("show");
      })
      .catch(function () {
        form.style.display = "none";
        okBox.classList.add("show");
      });
  });

  render();
})();
