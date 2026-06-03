(function () {
  "use strict";

  var STORAGE_KEY_CLOCKS = "world-clocks-saved";
  var STORAGE_KEY_FORMAT = "world-clocks-format-24";
  var STORAGE_KEY_SECONDS = "world-clocks-show-seconds";
  var STORAGE_KEY_WEATHER = "world-clocks-show-weather";
  var STORAGE_KEY_DATE = "world-clocks-show-date";
  var STORAGE_KEY_LOCATION_META = "world-clocks-show-location-meta";
  var STORAGE_KEY_TIME_META = "world-clocks-show-time-meta";
  var STORAGE_KEY_HIDE_CURRENT = "world-clocks-hide-current";
  var SWIPE_DELETE_WIDTH = 88;
  var DEFAULT_CLOCK = {
    name: "Nashville",
    admin1: "Tennessee",
    country: "United States",
    latitude: 36.1627,
    longitude: -86.7816,
    timezone: "America/Chicago"
  };

  var appState = {
    defaultClock: cloneClock(DEFAULT_CLOCK),
    defaultClockSource: "fallback",
    hideCurrentLocationClock: false,
    savedClocks: [],
    use24Hour: false,
    showSeconds: false,
    showWeather: false,
    showDate: false,
    showLocationMeta: true,
    showTimeMeta: true,
    useSwipeLayout: false,
    formatterCache: {},
    tickTimer: null,
    searchTimer: null,
    searchRequest: null,
    reverseGeocodeRequest: null,
    lastFocusedElement: null,
    activeSwipedRow: null,
    activeModalName: ""
  };

  var elements = {
    appShell: document.querySelector(".app-shell"),
    clockList: document.getElementById("clock-list"),
    clockTemplate: document.getElementById("clock-row-template"),
    addCityButton: document.getElementById("add-city-button"),
    settingsButton: document.getElementById("settings-button"),
    resetButton: document.getElementById("reset-button"),
    citySearch: document.getElementById("city-search"),
    searchStatus: document.getElementById("search-status"),
    searchResults: document.getElementById("search-results"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    addCityModal: document.getElementById("add-city-modal"),
    addCityClose: document.getElementById("add-city-close"),
    settingsModal: document.getElementById("settings-modal"),
    settingsClose: document.getElementById("settings-close"),
    setting24Hour: document.getElementById("setting-24-hour"),
    settingSeconds: document.getElementById("setting-seconds"),
    settingWeather: document.getElementById("setting-weather"),
    settingDate: document.getElementById("setting-date"),
    settingLocationMeta: document.getElementById("setting-location-meta"),
    settingTimeMeta: document.getElementById("setting-time-meta")
  };

  // Boot from localStorage first so the app still works when APIs are unavailable.
  function init() {
    loadPreferences();
    loadSavedClocks();
    updateTouchLayout(false);
    bindEvents();
    renderClocks();
    startClockUpdates();
    resolveDefaultClock();
  }

  function bindEvents() {
    syncSettingsInputs();
    applyDisplaySettings();
    elements.addCityButton.addEventListener("click", openAddCityModal, false);
    elements.settingsButton.addEventListener("click", openSettingsModal, false);
    elements.resetButton.addEventListener("click", onResetClick, false);
    elements.citySearch.addEventListener("input", onSearchInput, false);
    elements.setting24Hour.addEventListener("change", onSettingsChange, false);
    elements.settingSeconds.addEventListener("change", onSettingsChange, false);
    elements.settingWeather.addEventListener("change", onSettingsChange, false);
    elements.settingDate.addEventListener("change", onSettingsChange, false);
    elements.settingLocationMeta.addEventListener("change", onSettingsChange, false);
    elements.settingTimeMeta.addEventListener("change", onSettingsChange, false);
    elements.addCityClose.addEventListener("click", closeActiveModal, false);
    elements.settingsClose.addEventListener("click", closeSettingsModal, false);
    elements.modalBackdrop.addEventListener("click", closeActiveModal, false);
    document.addEventListener("keydown", onDocumentKeyDown, false);
    window.addEventListener("resize", onWindowResize, false);
  }

  function loadPreferences() {
    var storedFormat = readStorage(STORAGE_KEY_FORMAT);
    var storedSeconds = readStorage(STORAGE_KEY_SECONDS);
    var storedWeather = readStorage(STORAGE_KEY_WEATHER);
    var storedDate = readStorage(STORAGE_KEY_DATE);
    var storedLocationMeta = readStorage(STORAGE_KEY_LOCATION_META);
    var storedTimeMeta = readStorage(STORAGE_KEY_TIME_META);
    var storedHideCurrent = readStorage(STORAGE_KEY_HIDE_CURRENT);
    appState.use24Hour = storedFormat === "true";
    appState.showSeconds = storedSeconds === "true";
    appState.showWeather = storedWeather === "true";
    appState.showDate = storedDate === "true";
    appState.showLocationMeta = storedLocationMeta !== "false";
    appState.showTimeMeta = storedTimeMeta !== "false";
    appState.hideCurrentLocationClock = storedHideCurrent === "true";
  }

  function loadSavedClocks() {
    var raw = readStorage(STORAGE_KEY_CLOCKS);
    var parsed;
    var i;
    var cleaned = [];

    if (!raw) {
      appState.savedClocks = [];
      return;
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      appState.savedClocks = [];
      return;
    }

    if (!isArray(parsed)) {
      appState.savedClocks = [];
      return;
    }

    for (i = 0; i < parsed.length; i += 1) {
      if (isValidClock(parsed[i])) {
        cleaned.push(normalizeClock(parsed[i]));
      }
    }

    appState.savedClocks = cleaned;
  }

  function onSettingsChange() {
    appState.use24Hour = !!elements.setting24Hour.checked;
    appState.showSeconds = !!elements.settingSeconds.checked;
    appState.showWeather = !!elements.settingWeather.checked;
    appState.showDate = !!elements.settingDate.checked;
    appState.showLocationMeta = !!elements.settingLocationMeta.checked;
    appState.showTimeMeta = !!elements.settingTimeMeta.checked;
    appState.formatterCache = {};
    writeStorage(STORAGE_KEY_FORMAT, String(appState.use24Hour));
    writeStorage(STORAGE_KEY_SECONDS, String(appState.showSeconds));
    writeStorage(STORAGE_KEY_WEATHER, String(appState.showWeather));
    writeStorage(STORAGE_KEY_DATE, String(appState.showDate));
    writeStorage(STORAGE_KEY_LOCATION_META, String(appState.showLocationMeta));
    writeStorage(STORAGE_KEY_TIME_META, String(appState.showTimeMeta));
    applyDisplaySettings();
    updateRenderedTimes();
  }

  function onResetClick() {
    abortRequest(appState.searchRequest);
    abortRequest(appState.reverseGeocodeRequest);
    appState.searchRequest = null;
    appState.reverseGeocodeRequest = null;
    appState.savedClocks = [];
    appState.defaultClockSource = "fallback";
    appState.hideCurrentLocationClock = false;
    appState.use24Hour = false;
    appState.showSeconds = false;
    appState.showWeather = false;
    appState.showDate = false;
    appState.showLocationMeta = true;
    appState.showTimeMeta = true;
    appState.formatterCache = {};
    writeStorage(STORAGE_KEY_CLOCKS, JSON.stringify([]));
    writeStorage(STORAGE_KEY_FORMAT, "false");
    writeStorage(STORAGE_KEY_SECONDS, "false");
    writeStorage(STORAGE_KEY_WEATHER, "false");
    writeStorage(STORAGE_KEY_DATE, "false");
    writeStorage(STORAGE_KEY_LOCATION_META, "true");
    writeStorage(STORAGE_KEY_TIME_META, "true");
    writeStorage(STORAGE_KEY_HIDE_CURRENT, "false");
    clearSearchResults();
    elements.citySearch.value = "";
    setSearchStatus("");
    syncSettingsInputs();
    applyDisplaySettings();
    renderClocks();
    resolveDefaultClock();
  }

  function onSearchInput() {
    var query = trimString(elements.citySearch.value);

    if (appState.searchTimer) {
      clearTimeout(appState.searchTimer);
      appState.searchTimer = null;
    }

    if (query.length < 3) {
      abortRequest(appState.searchRequest);
      appState.searchRequest = null;
      clearSearchResults();
      setSearchStatus(query.length === 0 ? "" : "Type at least 3 characters to search.");
      return;
    }

    setSearchStatus("Searching...");
    appState.searchTimer = setTimeout(function () {
      appState.searchTimer = null;
      searchCities(query);
    }, 300);
  }

  function searchCities(query) {
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(query) +
      "&count=10&language=en&format=json";

    abortRequest(appState.searchRequest);

    appState.searchRequest = createJsonRequest(url, function (error, data) {
      appState.searchRequest = null;

      if (error) {
        clearSearchResults();
        setSearchStatus("City search is unavailable right now. Try again later.", true);
        return;
      }

      renderSearchResults(data && data.results ? data.results : []);
    });
  }

  function renderSearchResults(results) {
    var i;
    var item;
    var listItem;
    var button;
    var name;
    var meta;
    var resultClock;

    clearSearchResults();

    if (!results || !results.length) {
      setSearchStatus("No cities found.");
      return;
    }

    setSearchStatus("Select a city to add its clock.");

    for (i = 0; i < results.length; i += 1) {
      item = results[i];
      listItem = document.createElement("li");
      button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-index", String(i));

      name = document.createElement("span");
      name.className = "result-name";
      name.appendChild(document.createTextNode(buildLocationTitle(item)));

      meta = document.createElement("span");
      meta.className = "result-meta";
      meta.appendChild(document.createTextNode(buildResultMeta(item)));

      button.appendChild(name);
      button.appendChild(meta);

      resultClock = normalizeClock({
        name: item.name || "Unknown",
        admin1: item.admin1 || "",
        country: item.country || "",
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone || ""
      });

      attachClockData(button, resultClock);

      button.addEventListener("click", onSearchResultClick, false);
      listItem.appendChild(button);
      elements.searchResults.appendChild(listItem);
    }
  }

  function onSearchResultClick(event) {
    var clock = readClockData(event.currentTarget);

    if (!clock) {
      return;
    }

    if (hasClock(clock)) {
      setSearchStatus("That clock is already shown.");
      clearSearchResults();
      return;
    }

    appState.savedClocks.push(clock);
    persistSavedClocks();
    renderClocks();
    clearSearchResults();
    elements.citySearch.value = "";
    setSearchStatus("Clock added.");
    closeActiveModal();
  }

  function resolveDefaultClock() {
    var geo;

    geo = navigator.geolocation;
    if (!geo || typeof geo.getCurrentPosition !== "function") {
      setDefaultClock(DEFAULT_CLOCK, "Using Nashville.");
      return;
    }

    geo.getCurrentPosition(
      function (position) {
        useCurrentPosition(position);
      },
      function () {
        setDefaultClock(DEFAULT_CLOCK, "Using Nashville.");
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000
      }
    );
  }

  // Show a usable local clock immediately, then try to replace its label with a city name.
  function useCurrentPosition(position) {
    var latitude = position && position.coords ? position.coords.latitude : null;
    var longitude = position && position.coords ? position.coords.longitude : null;
    var browserZone = getBrowserTimeZone() || DEFAULT_CLOCK.timezone;
    var fallbackClock;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      setDefaultClock(DEFAULT_CLOCK, "Using Nashville.");
      return;
    }

    fallbackClock = normalizeClock({
      name: "Current Location",
      admin1: "",
      country: "",
      latitude: latitude,
      longitude: longitude,
      timezone: browserZone
    });

    setDefaultClock(fallbackClock, "Using your current location.", "current");

    reverseGeocodeCurrentLocation(latitude, longitude, browserZone);
  }

  function reverseGeocodeCurrentLocation(latitude, longitude, browserZone) {
    var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=" +
      encodeURIComponent(String(latitude)) +
      "&lon=" +
      encodeURIComponent(String(longitude));

    abortRequest(appState.reverseGeocodeRequest);

    appState.reverseGeocodeRequest = createJsonRequest(url, function (error, data) {
      var address;
      var updatedClock;

      appState.reverseGeocodeRequest = null;

      if (error || !data) {
        return;
      }

      address = data.address || {};
      updatedClock = normalizeClock({
        name: address.city || address.town || address.village || address.municipality || "Current Location",
        admin1: address.state || address.region || "",
        country: address.country || "",
        latitude: latitude,
        longitude: longitude,
        timezone: browserZone
      });

      setDefaultClock(
        updatedClock,
        updatedClock.name === "Current Location" ? "Using your current location." : "Showing your current city.",
        "current"
      );
    });
  }

  function setDefaultClock(clock, statusText, source) {
    appState.defaultClock = normalizeClock(clock);
    appState.defaultClockSource = source || "fallback";
    renderClocks();
  }

  function persistSavedClocks() {
    writeStorage(STORAGE_KEY_CLOCKS, JSON.stringify(appState.savedClocks));
  }

  function renderClocks() {
    var fragment = document.createDocumentFragment();
    var combinedClocks = getVisibleClocks();
    var i;
    var row;

    elements.clockList.innerHTML = "";

    for (i = 0; i < combinedClocks.length; i += 1) {
      row = createClockRow(combinedClocks[i], i === 0);
      fragment.appendChild(row);
    }

    elements.clockList.appendChild(fragment);
    bindSwipeRows();
    updateRenderedTimes();
  }

  function createClockRow(clock, isDefault) {
    var row = elements.clockTemplate.content ?
      elements.clockTemplate.content.firstElementChild.cloneNode(true) :
      createFallbackTemplateClone();
    var removeButton = row.querySelector(".remove-button");
    var swipeDeleteButton = row.querySelector(".swipe-delete-button");

    row.setAttribute("data-timezone", clock.timezone);

    if (isDefault) {
      configureDefaultClockButton(row, removeButton, swipeDeleteButton, clock);
    } else {
      attachClockData(removeButton, clock);
      attachClockData(swipeDeleteButton, clock);
      removeButton.addEventListener("click", onRemoveClockClick, false);
      swipeDeleteButton.addEventListener("click", onRemoveClockClick, false);
    }

    row.querySelector(".location-main").textContent = clock.name;
    row.querySelector(".location-meta").textContent = buildLocationMeta(clock);
    row.querySelector(".time-main").textContent = "--:--:--";
    row.querySelector(".time-meta").textContent = clock.timezone || "";
    row.querySelector(".date-main").textContent = "--";

    /*
      Future weather support:
      - Fetch weather data from the Open-Meteo Forecast API with the clock latitude/longitude.
      - Populate current temperature, daily high, daily low, and a weather condition icon here.
    */

    return row;
  }

  function createFallbackTemplateClone() {
    var wrapper = document.createElement("div");
    wrapper.innerHTML =
      '<article class="clock-row">' +
      '<button class="swipe-delete-button" type="button" aria-label="Delete clock"><span class="trash-icon" aria-hidden="true"></span><span class="sr-only">Delete</span></button>' +
      '<div class="clock-row-inner">' +
      '<div class="clock-col clock-col-location"><div class="location-main"></div><div class="location-meta"></div></div>' +
      '<div class="clock-col clock-col-time"><div class="time-main"></div><div class="time-meta"></div></div>' +
      '<div class="clock-col clock-col-date"><div class="date-main"></div></div>' +
      '<div class="clock-col clock-col-weather weather-slot"><div class="weather-placeholder">--</div><div class="weather-meta">Temp / High / Low / Icon</div></div>' +
      '<div class="clock-col clock-col-actions"><button class="remove-button" type="button">Remove</button></div>' +
      '</div>' +
      '</article>';
    return wrapper.firstChild;
  }

  function onRemoveClockClick(event) {
    var clock = readClockData(event.currentTarget);
    var updatedClocks = [];
    var i;
    var existing;

    if (!clock) {
      return;
    }

    for (i = 0; i < appState.savedClocks.length; i += 1) {
      existing = appState.savedClocks[i];
      if (clockKey(existing) !== clockKey(clock)) {
        updatedClocks.push(existing);
      }
    }

    appState.savedClocks = updatedClocks;
    persistSavedClocks();
    renderClocks();
  }

  function onRemoveDefaultClockClick() {
    appState.hideCurrentLocationClock = true;
    writeStorage(STORAGE_KEY_HIDE_CURRENT, "true");
    renderClocks();
  }

  function bindSwipeRows() {
    var rows;
    var i;

    appState.activeSwipedRow = null;

    if (!appState.useSwipeLayout) {
      return;
    }

    rows = elements.clockList.getElementsByClassName("clock-row");
    for (i = 0; i < rows.length; i += 1) {
      bindSwipeRow(rows[i]);
    }
  }

  function bindSwipeRow(row) {
    var rowInner = row.querySelector(".clock-row-inner");
    var swipeState;

    if (!rowInner || row.getAttribute("data-swipe-bound") === "true") {
      return;
    }

    swipeState = {
      startX: 0,
      startY: 0,
      baseOffset: 0,
      currentOffset: 0,
      isTracking: false,
      isHorizontal: false
    };

    row.setAttribute("data-swipe-bound", "true");

    rowInner.addEventListener("touchstart", function (event) {
      var touch;

      if (!appState.useSwipeLayout || !event.touches || !event.touches.length) {
        return;
      }

      closeOtherSwipedRows(row);

      touch = event.touches[0];
      swipeState.startX = touch.pageX;
      swipeState.startY = touch.pageY;
      swipeState.baseOffset = isRowSwiped(row) ? -SWIPE_DELETE_WIDTH : 0;
      swipeState.currentOffset = swipeState.baseOffset;
      swipeState.isTracking = true;
      swipeState.isHorizontal = false;
      rowInner.style.webkitTransition = "none";
      rowInner.style.transition = "none";
    }, false);

    rowInner.addEventListener("touchmove", function (event) {
      var touch;
      var deltaX;
      var deltaY;
      var nextOffset;

      if (!swipeState.isTracking || !event.touches || !event.touches.length) {
        return;
      }

      touch = event.touches[0];
      deltaX = touch.pageX - swipeState.startX;
      deltaY = touch.pageY - swipeState.startY;

      if (!swipeState.isHorizontal) {
        if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
          swipeState.isHorizontal = true;
        } else if (Math.abs(deltaY) > 10) {
          swipeState.isTracking = false;
          restoreRowTransition(rowInner);
          return;
        }
      }

      if (!swipeState.isHorizontal) {
        return;
      }

      nextOffset = swipeState.baseOffset + deltaX;
      if (nextOffset > 0) {
        nextOffset = 0;
      }
      if (nextOffset < -SWIPE_DELETE_WIDTH) {
        nextOffset = -SWIPE_DELETE_WIDTH;
      }

      swipeState.currentOffset = nextOffset;
      setRowOffset(rowInner, nextOffset);

      if (event.cancelable) {
        event.preventDefault();
      }
    }, false);

    rowInner.addEventListener("touchend", function () {
      finishSwipe(row, rowInner, swipeState);
    }, false);

    rowInner.addEventListener("touchcancel", function () {
      finishSwipe(row, rowInner, swipeState);
    }, false);

    rowInner.addEventListener("click", function (event) {
      if (isRowSwiped(row)) {
        closeSwipedRow(row);
        event.preventDefault();
      }
    }, false);
  }

  function finishSwipe(row, rowInner, swipeState) {
    if (!swipeState.isTracking) {
      return;
    }

    swipeState.isTracking = false;
    restoreRowTransition(rowInner);

    if (swipeState.isHorizontal && swipeState.currentOffset <= (-SWIPE_DELETE_WIDTH / 2)) {
      openSwipedRow(row);
      return;
    }

    closeSwipedRow(row);
  }

  function startClockUpdates() {
    if (appState.tickTimer) {
      clearInterval(appState.tickTimer);
    }

    appState.tickTimer = setInterval(function () {
      updateRenderedTimes();
    }, 1000);
  }

  function updateRenderedTimes() {
    var rows = elements.clockList.getElementsByClassName("clock-row");
    var combinedClocks = getVisibleClocks();
    var now = new Date();
    var i;
    var row;
    var clock;
    var timeParts;

    for (i = 0; i < rows.length; i += 1) {
      row = rows[i];
      clock = combinedClocks[i];

      if (!clock) {
        continue;
      }

      timeParts = formatClockTime(now, clock.timezone, appState.use24Hour);

      row.querySelector(".time-main").textContent = timeParts.timeText;
      row.querySelector(".time-meta").textContent = buildTimeMetaText(timeParts, clock);
      row.querySelector(".date-main").textContent = timeParts.dateText;
    }
  }

  function formatClockTime(date, timeZone, use24Hour) {
    var formatterSet = getFormatterSet(timeZone, use24Hour, appState.showSeconds);

    return {
      timeText: formatterSet.timeFormatter.format(date),
      dateText: formatterSet.dateFormatter.format(date),
      zoneAbbreviation: extractZoneAbbreviation(formatterSet.zoneFormatter, date),
      utcOffsetText: formatUtcOffset(date, timeZone)
    };
  }

  function buildTimeMetaText(timeParts, clock) {
    var pieces = [];

    if (timeParts.zoneAbbreviation) {
      pieces.push(timeParts.zoneAbbreviation);
    } else if (clock.timezone) {
      pieces.push(clock.timezone);
    }

    if (timeParts.utcOffsetText) {
      pieces.push(timeParts.utcOffsetText);
    }

    return pieces.join(" | ");
  }

  function getFormatterSet(timeZone, use24Hour, showSeconds) {
    var cacheKey = timeZone + "|" + (use24Hour ? "24" : "12") + "|" + (showSeconds ? "seconds" : "minutes");
    var timeOptions;

    if (!appState.formatterCache[cacheKey]) {
      try {
        timeOptions = {
          timeZone: timeZone,
          hour: "numeric",
          minute: "2-digit",
          hour12: !use24Hour
        };

        if (showSeconds) {
          timeOptions.second = "2-digit";
        }

        appState.formatterCache[cacheKey] = {
          timeFormatter: new Intl.DateTimeFormat("en-US", timeOptions),
          dateFormatter: new Intl.DateTimeFormat("en-US", {
            timeZone: timeZone,
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
          }),
          zoneFormatter: new Intl.DateTimeFormat("en-US", {
            timeZone: timeZone,
            timeZoneName: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }),
          offsetFormatter: new Intl.DateTimeFormat("en-US", {
            timeZone: timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          })
        };
      } catch (error) {
        if (timeZone === DEFAULT_CLOCK.timezone) {
          throw error;
        }
        return getFormatterSet(DEFAULT_CLOCK.timezone, use24Hour, showSeconds);
      }
    }

    return appState.formatterCache[cacheKey];
  }

  function extractZoneAbbreviation(formatter, date) {
    var parts;
    var i;

    if (typeof formatter.formatToParts !== "function") {
      return "";
    }

    parts = formatter.formatToParts(date);
    for (i = 0; i < parts.length; i += 1) {
      if (parts[i].type === "timeZoneName") {
        return parts[i].value;
      }
    }

    return "";
  }

  function formatUtcOffset(date, timeZone) {
    var offsetMinutes = getOffsetMinutes(date, timeZone);
    var sign = offsetMinutes >= 0 ? "+" : "-";
    var absoluteMinutes = Math.abs(offsetMinutes);
    var hours = Math.floor(absoluteMinutes / 60);
    var minutes = absoluteMinutes % 60;

    return "UTC" + sign + padNumber(hours) + ":" + padNumber(minutes);
  }

  function getOffsetMinutes(date, timeZone) {
    var formatter = getFormatterSet(timeZone, appState.use24Hour, appState.showSeconds).offsetFormatter;
    var parts;
    var map = {};
    var i;
    var utcTime;
    var hourValue;

    if (typeof formatter.formatToParts !== "function") {
      return 0;
    }

    parts = formatter.formatToParts(date);
    for (i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== "literal") {
        map[parts[i].type] = parts[i].value;
      }
    }

    hourValue = parseInt(map.hour, 10);
    if (hourValue === 24) {
      hourValue = 0;
    }

    utcTime = Date.UTC(
      parseInt(map.year, 10),
      parseInt(map.month, 10) - 1,
      parseInt(map.day, 10),
      hourValue,
      parseInt(map.minute, 10),
      parseInt(map.second, 10)
    );

    return Math.round((utcTime - date.getTime()) / 60000);
  }

  function hasClock(clock) {
    var allClocks = getVisibleClocks();
    var i;

    for (i = 0; i < allClocks.length; i += 1) {
      if (clockKey(allClocks[i]) === clockKey(clock)) {
        return true;
      }
    }

    return false;
  }

  function clockKey(clock) {
    return [
      safeLower(clock.name),
      safeLower(clock.admin1),
      safeLower(clock.country),
      normalizeCoordinate(clock.latitude),
      normalizeCoordinate(clock.longitude),
      safeLower(clock.timezone)
    ].join("|");
  }

  function normalizeClock(source) {
    return {
      name: source.name || "Unknown",
      admin1: source.admin1 || "",
      country: source.country || "",
      latitude: parseFloat(source.latitude),
      longitude: parseFloat(source.longitude),
      timezone: source.timezone || DEFAULT_CLOCK.timezone
    };
  }

  function cloneClock(clock) {
    return normalizeClock(clock);
  }

  function isValidClock(clock) {
    if (!clock || typeof clock !== "object") {
      return false;
    }

    if (typeof clock.name !== "string" || typeof clock.timezone !== "string") {
      return false;
    }

    if (isNaN(parseFloat(clock.latitude)) || isNaN(parseFloat(clock.longitude))) {
      return false;
    }

    return true;
  }

  function buildLocationTitle(item) {
    var parts = [item.name || "Unknown"];

    if (item.admin1) {
      parts.push(item.admin1);
    }

    if (item.country) {
      parts.push(item.country);
    }

    return parts.join(", ");
  }

  function buildResultMeta(item) {
    var pieces = [];

    if (item.admin1) {
      pieces.push(item.admin1);
    }

    if (item.country) {
      pieces.push(item.country);
    }

    if (item.timezone) {
      pieces.push(item.timezone);
    }

    return pieces.join(" | ");
  }

  function buildLocationMeta(clock) {
    var pieces = [];

    if (clock.admin1) {
      pieces.push(clock.admin1);
    }

    if (clock.country) {
      pieces.push(clock.country);
    }

    return pieces.join(", ") || clock.timezone;
  }

  function configureDefaultClockButton(row, removeButton, swipeDeleteButton, clock) {
    if (row.className.indexOf("is-default") === -1) {
      row.className += " is-default";
    }

    attachClockData(removeButton, clock);
    attachClockData(swipeDeleteButton, clock);
    removeButton.textContent = "Remove";
    removeButton.disabled = false;
    removeButton.addEventListener("click", onRemoveDefaultClockClick, false);
    swipeDeleteButton.addEventListener("click", onRemoveDefaultClockClick, false);
  }

  function shouldShowDefaultClock() {
    if (appState.hideCurrentLocationClock) {
      return false;
    }

    return true;
  }

  function getVisibleClocks() {
    var clocks = [];

    if (shouldShowDefaultClock()) {
      clocks.push(appState.defaultClock);
    }

    return clocks.concat(appState.savedClocks);
  }

  function setSearchStatus(message, isError) {
    elements.searchStatus.className = isError ? "search-status error" : "search-status";
    elements.searchStatus.textContent = message;
  }

  function clearSearchResults() {
    elements.searchResults.innerHTML = "";
  }

  function syncSettingsInputs() {
    elements.setting24Hour.checked = appState.use24Hour;
    elements.settingSeconds.checked = appState.showSeconds;
    elements.settingWeather.checked = appState.showWeather;
    elements.settingDate.checked = appState.showDate;
    elements.settingLocationMeta.checked = appState.showLocationMeta;
    elements.settingTimeMeta.checked = appState.showTimeMeta;
  }

  function applyDisplaySettings() {
    if (appState.showWeather) {
      removeClass(elements.appShell, "hide-weather");
    } else {
      addClass(elements.appShell, "hide-weather");
    }

    if (appState.showDate) {
      removeClass(elements.appShell, "hide-date");
    } else {
      addClass(elements.appShell, "hide-date");
    }

    if (appState.showLocationMeta) {
      removeClass(elements.appShell, "hide-location-meta");
    } else {
      addClass(elements.appShell, "hide-location-meta");
    }

    if (appState.showTimeMeta) {
      removeClass(elements.appShell, "hide-time-meta");
    } else {
      addClass(elements.appShell, "hide-time-meta");
    }
  }

  function openSettingsModal() {
    closeAllSwipedRows();
    appState.lastFocusedElement = document.activeElement;
    syncSettingsInputs();
    appState.activeModalName = "settings";
    elements.settingsButton.setAttribute("aria-expanded", "true");
    elements.modalBackdrop.className = "modal-backdrop";
    elements.settingsModal.className = "settings-modal";
    elements.settingsModal.setAttribute("aria-hidden", "false");
    setTimeout(function () {
      if (elements.setting24Hour && typeof elements.setting24Hour.focus === "function") {
        elements.setting24Hour.focus();
      }
    }, 0);
  }

  function closeSettingsModal() {
    appState.activeModalName = "";
    elements.settingsButton.setAttribute("aria-expanded", "false");
    elements.modalBackdrop.className = "modal-backdrop is-hidden";
    elements.settingsModal.className = "settings-modal is-hidden";
    elements.settingsModal.setAttribute("aria-hidden", "true");

    if (appState.lastFocusedElement && typeof appState.lastFocusedElement.focus === "function") {
      appState.lastFocusedElement.focus();
    }
  }

  function openAddCityModal() {
    closeAllSwipedRows();
    appState.lastFocusedElement = document.activeElement;
    appState.activeModalName = "add-city";
    elements.addCityButton.setAttribute("aria-expanded", "true");
    elements.modalBackdrop.className = "modal-backdrop";
    elements.addCityModal.className = "settings-modal";
    elements.addCityModal.setAttribute("aria-hidden", "false");
    setTimeout(function () {
      if (elements.citySearch && typeof elements.citySearch.focus === "function") {
        elements.citySearch.focus();
      }
    }, 0);
  }

  function closeAddCityModal() {
    appState.activeModalName = "";
    elements.addCityButton.setAttribute("aria-expanded", "false");
    elements.modalBackdrop.className = "modal-backdrop is-hidden";
    elements.addCityModal.className = "settings-modal is-hidden";
    elements.addCityModal.setAttribute("aria-hidden", "true");

    if (appState.lastFocusedElement && typeof appState.lastFocusedElement.focus === "function") {
      appState.lastFocusedElement.focus();
    }
  }

  function closeActiveModal() {
    if (appState.activeModalName === "settings") {
      closeSettingsModal();
      return;
    }

    if (appState.activeModalName === "add-city") {
      closeAddCityModal();
    }
  }

  function onDocumentKeyDown(event) {
    var key = event.key || event.keyCode;

    if (!appState.activeModalName) {
      return;
    }

    if (key === "Escape" || key === "Esc" || key === 27) {
      closeActiveModal();
      closeAllSwipedRows();
    }
  }

  function onWindowResize() {
    updateTouchLayout(true);
  }

  function createJsonRequest(url, callback) {
    var xhr = new XMLHttpRequest();
    var isAborted = false;

    xhr.open("GET", url, true);
    xhr.timeout = 8000;
    xhr.onreadystatechange = function () {
      var response;

      if (xhr.readyState !== 4 || isAborted) {
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          response = JSON.parse(xhr.responseText);
        } catch (error) {
          callback(error);
          return;
        }

        callback(null, response);
        return;
      }

      callback(new Error("Request failed"));
    };

    xhr.onerror = function () {
      if (isAborted) {
        return;
      }
      callback(new Error("Network error"));
    };

    xhr.ontimeout = function () {
      if (isAborted) {
        return;
      }
      callback(new Error("Request timed out"));
    };

    xhr._abortSafely = function () {
      isAborted = true;
      xhr.abort();
    };

    xhr.send();
    return xhr;
  }

  function abortRequest(xhr) {
    if (xhr && typeof xhr._abortSafely === "function") {
      try {
        xhr._abortSafely();
      } catch (error) {
        return;
      }
    }
  }

  function getBrowserTimeZone() {
    var resolvedOptions;

    try {
      resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
      return resolvedOptions && resolvedOptions.timeZone ? resolvedOptions.timeZone : "";
    } catch (error) {
      return "";
    }
  }

  function attachClockData(element, clock) {
    element.setAttribute("data-clock", JSON.stringify(clock));
  }

  function readClockData(element) {
    var raw = element.getAttribute("data-clock");

    if (!raw) {
      return null;
    }

    try {
      return normalizeClock(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return null;
    }
  }

  function normalizeCoordinate(value) {
    var numberValue = parseFloat(value);

    if (isNaN(numberValue)) {
      return "";
    }

    return numberValue.toFixed(4);
  }

  function padNumber(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function trimString(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "");
  }

  function safeLower(value) {
    return String(value || "").toLowerCase();
  }

  function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
  }

  function addClass(element, className) {
    if (!element) {
      return;
    }

    if ((" " + element.className + " ").indexOf(" " + className + " ") === -1) {
      element.className += (element.className ? " " : "") + className;
    }
  }

  function removeClass(element, className) {
    var current;

    if (!element) {
      return;
    }

    current = " " + element.className + " ";
    current = current.replace(" " + className + " ", " ");
    element.className = trimString(current);
  }

  function updateTouchLayout(shouldRender) {
    var nextValue = detectSwipeLayout();

    if (appState.useSwipeLayout === nextValue) {
      return;
    }

    appState.useSwipeLayout = nextValue;

    if (appState.useSwipeLayout) {
      addClass(elements.appShell, "swipe-delete-layout");
    } else {
      removeClass(elements.appShell, "swipe-delete-layout");
      appState.activeSwipedRow = null;
    }

    if (shouldRender) {
      renderClocks();
    }
  }

  function detectSwipeLayout() {
    var userAgent = navigator.userAgent || "";
    var touchCapable = ("ontouchstart" in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);
    var mobileUserAgent = /iPad|iPhone|iPod|Android/i.test(userAgent);
    var maxDimension = Math.max(window.innerWidth || 0, window.innerHeight || 0);

    if (mobileUserAgent) {
      return true;
    }

    return !!(touchCapable && maxDimension && maxDimension <= 1180);
  }

  function setRowOffset(rowInner, offset) {
    var transformValue = "translateX(" + String(offset) + "px)";
    rowInner.style.webkitTransform = transformValue;
    rowInner.style.transform = transformValue;
  }

  function restoreRowTransition(rowInner) {
    rowInner.style.webkitTransition = "-webkit-transform 0.18s ease-out";
    rowInner.style.transition = "transform 0.18s ease-out";
  }

  function isRowSwiped(row) {
    return (" " + row.className + " ").indexOf(" is-swiped ") !== -1;
  }

  function openSwipedRow(row) {
    var rowInner;

    if (!row) {
      return;
    }

    closeOtherSwipedRows(row);
    rowInner = row.querySelector(".clock-row-inner");

    if (!rowInner) {
      return;
    }

    addClass(row, "is-swiped");
    restoreRowTransition(rowInner);
    setRowOffset(rowInner, -SWIPE_DELETE_WIDTH);
    appState.activeSwipedRow = row;
  }

  function closeSwipedRow(row) {
    var rowInner;

    if (!row) {
      return;
    }

    rowInner = row.querySelector(".clock-row-inner");
    if (!rowInner) {
      return;
    }

    removeClass(row, "is-swiped");
    restoreRowTransition(rowInner);
    setRowOffset(rowInner, 0);

    if (appState.activeSwipedRow === row) {
      appState.activeSwipedRow = null;
    }
  }

  function closeOtherSwipedRows(exceptRow) {
    if (appState.activeSwipedRow && appState.activeSwipedRow !== exceptRow) {
      closeSwipedRow(appState.activeSwipedRow);
    }
  }

  function closeAllSwipedRows() {
    closeOtherSwipedRows(null);
  }

  init();
}());
