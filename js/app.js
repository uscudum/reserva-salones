import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";
import { rooms, getRoomLabel, findRoomInfo, sortByRoom, roomSortValue } from "./rooms.js";
import {
  addDays,
  escapeHtml,
  formatCompactWeekend,
  formatReadableDate,
  formatShortDate,
  formatShortDateTime,
  formatTeacherShort,
  formatTeachers,
  getLevel,
  getNextFridayAndSaturday,
  getUnifiedTime,
  normalizeText,
  toDateInputValue,
  uniqueValues
} from "./utils.js";

const dateModeFilter = document.getElementById("dateModeFilter");
    const weekendFilter = document.getElementById("weekendFilter");
    const weekendField = document.getElementById("weekendField");
    const fromDateField = document.getElementById("fromDateField");
    const toDateField = document.getElementById("toDateField");
    const roomFilter = document.getElementById("roomFilter");
    const fromDateFilter = document.getElementById("fromDateFilter");
    const toDateFilter = document.getElementById("toDateFilter");
    const searchFilter = document.getElementById("searchFilter");
    const statusMessage = document.getElementById("statusMessage");
    const reservationsContainer = document.getElementById("reservationsContainer");
    const printInfo = document.getElementById("printInfo");
    const statsContainer = document.querySelector(".stats");


function isVisibleReservation(reserva) {
  const estado = normalizeText(reserva?.estado || "activa");
  return !["cancelada", "cancelado", "eliminada", "eliminado", "deleted", "borrada", "borrado"].includes(estado);
}


rooms.forEach(room => {
  const option = document.createElement("option");
  option.value = room.name;
  option.textContent = getRoomLabel(room);
  roomFilter.appendChild(option);
});

function compactReservations(reservas) {
      const grouped = new Map();

      reservas.forEach(reserva => {
        const roomInfo = findRoomInfo(reserva.salon);
        const key = `${reserva.fecha}__${normalizeText(roomInfo.name)}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            fecha: reserva.fecha,
            salon: roomInfo.name,
            roomInfo,
            especialidades: [],
            niveles: [],
            docentes: [],
            unidadesCurriculares: [],
            horarios: [],
            raw: []
          });
        }

        const item = grouped.get(key);
        item.raw.push(reserva);
        item.especialidades.push(reserva.especialidad || "No registrada");
        item.niveles.push(getLevel(reserva));
        item.docentes.push(...formatTeachers(reserva.docenteNombre, reserva.docenteCorreo));
        item.unidadesCurriculares.push(reserva.unidadCurricular || "No registrada");

        if (Array.isArray(reserva.horarios) && reserva.horarios.length > 0) {
          item.horarios.push(getUnifiedTime(reserva.horarios));
        } else {
          item.horarios.push("Sin horario");
        }
      });

      return Array.from(grouped.values()).map(item => ({
        ...item,
        especialidades: uniqueValues(item.especialidades),
        niveles: uniqueValues(item.niveles),
        docentes: uniqueValues(item.docentes),
        unidadesCurriculares: uniqueValues(item.unidadesCurriculares),
        horarios: uniqueValues(item.horarios)
      }));
    }

function populateWeekendFilter() {
      weekendFilter.innerHTML = "";
      const firstWeekend = getNextFridayAndSaturday();
      const options = [];

      for (let i = 0; i < 16; i++) {
        const friday = addDays(firstWeekend.friday, i * 7);
        const saturday = addDays(firstWeekend.saturday, i * 7);
        options.push({ friday, saturday });
      }

      options.forEach((option, index) => {
        const selectOption = document.createElement("option");
        selectOption.value = `${option.friday}|${option.saturday}`;
        selectOption.textContent = `${index === 0 ? "Próximo: " : ""}${formatCompactWeekend(option.friday, option.saturday)}`;
        weekendFilter.appendChild(selectOption);
      });
    }

function getSelectedDateRange() {
      if (dateModeFilter.value === "all") {
        return { from: "", to: "" };
      }

      if (dateModeFilter.value === "custom") {
        return {
          from: fromDateFilter.value,
          to: toDateFilter.value
        };
      }

      const [from, to] = weekendFilter.value.split("|");
      return { from, to };
    }

function updateDateModeView() {
      const mode = dateModeFilter.value;
      weekendField.classList.toggle("isHidden", mode !== "weekend");
      fromDateField.classList.toggle("isHidden", mode !== "custom");
      toDateField.classList.toggle("isHidden", mode !== "custom");
    }

function getStats(reservas) {
      return {
        reservations: reservas.length,
        dates: new Set(reservas.map(r => r.fecha).filter(Boolean)).size,
        rooms: new Set(reservas.map(r => findRoomInfo(r.salon).name).filter(Boolean)).size,
        teachers: new Set(reservas.map(r => normalizeText(r.docenteCorreo || r.docenteNombre)).filter(Boolean)).size
      };
    }

function getReservationCreatedDate(reserva) {
      const possibleDates = [
        reserva.actualizadoEn,
        reserva.creadoEn,
        reserva.createdAt,
        reserva.fechaCreacion,
        reserva.timestamp,
        reserva.created_at,
        reserva.fechaIngreso,
        reserva.ingresadoEn
      ];

      for (const value of possibleDates) {
        if (!value) continue;

        if (typeof value.toDate === "function") {
          const date = value.toDate();
          if (!Number.isNaN(date.getTime())) return date;
        }

        if (typeof value.toMillis === "function") {
          const date = new Date(value.toMillis());
          if (!Number.isNaN(date.getTime())) return date;
        }

        if (typeof value === "object" && typeof value.seconds === "number") {
          const milliseconds = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
          const date = new Date(milliseconds);
          if (!Number.isNaN(date.getTime())) return date;
        }

        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date;
      }

      return null;
    }

function getStartOfCurrentWeek() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Semana de ingreso: domingo 00:00 a domingo siguiente 00:00.
      // Esto permite contar quiénes ingresaron reservas entre domingo y sábado.
      today.setDate(today.getDate() - today.getDay());

      return today;
    }

function getEndOfCurrentWeek() {
      const end = getStartOfCurrentWeek();
      end.setDate(end.getDate() + 7);
      return end;
    }

function countReservationsCreatedThisWeek(reservas = []) {
      const start = getStartOfCurrentWeek();
      const end = getEndOfCurrentWeek();

      return reservas.filter(reserva => {
        const createdDate = getReservationCreatedDate(reserva);
        return createdDate && createdDate >= start && createdDate < end;
      }).length;
    }

function getStartOfCurrentDay() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

function getEndOfCurrentDay() {
      const end = getStartOfCurrentDay();
      end.setDate(end.getDate() + 1);
      return end;
    }

function getStartOfCurrentMonth() {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }

function getEndOfCurrentMonth() {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }

function countReservationsCreatedBetween(reservas = [], start, end) {
      return reservas.filter(reserva => {
        const createdDate = getReservationCreatedDate(reserva);
        return createdDate && createdDate >= start && createdDate < end;
      }).length;
    }

function countReservationsCreatedToday(reservas = []) {
      return countReservationsCreatedBetween(reservas, getStartOfCurrentDay(), getEndOfCurrentDay());
    }

function countReservationsCreatedThisMonth(reservas = []) {
      return countReservationsCreatedBetween(reservas, getStartOfCurrentMonth(), getEndOfCurrentMonth());
    }

function countFutureReservationDates(reservas = []) {
      const todayText = toDateInputValue(new Date());
      return new Set(
        reservas
          .map(reserva => reserva.fecha)
          .filter(fecha => fecha && fecha >= todayText)
      ).size;
    }

function getTopUsedRooms(reservas = [], limit = 3) {
      const counts = new Map();

      reservas.forEach(reserva => {
        const roomName = findRoomInfo(reserva.salon).name;
        if (!roomName || roomName === "Sin salón") return;
        counts.set(roomName, (counts.get(roomName) || 0) + 1);
      });

      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || roomSortValue(a[0]) - roomSortValue(b[0]) || a[0].localeCompare(b[0], "es", { numeric: true }))
        .slice(0, limit)
        .map(([roomName, count]) => ({ roomName, count }));
    }

function getMostUsedRoom(reservas = []) {
      const topRooms = getTopUsedRooms(reservas, 1);
      return topRooms.length ? topRooms[0].roomName : "Sin datos";
    }

function renderTopUsedRooms(reservas = []) {
      const topRooms = getTopUsedRooms(reservas, 3);

      if (topRooms.length === 0) {
        return `<small>Sin datos</small>`;
      }

      return topRooms.map((room, index) => {
        const label = index === 0 ? "Más usado" : `${index + 1}.º más usado`;
        const reservationText = `${room.count} 🔒`;
        return `<small>${label}: <strong>${escapeHtml(room.roomName)}</strong> · <span class="roomCount">${reservationText}</span></small>`;
      }).join("");
    }

function getLatestReservations(reservas = [], limit = 3) {
      return [...reservas]
        .map(reserva => ({ reserva, createdDate: getReservationCreatedDate(reserva) }))
        .filter(item => item.createdDate)
        .sort((a, b) => b.createdDate - a.createdDate)
        .slice(0, limit)
        .map(item => item.reserva);
    }

function renderLatestReservations(reservas = []) {
      const latestReservations = getLatestReservations(reservas, 3);

      if (latestReservations.length === 0) {
        return `<small>No se encontró fecha/hora de ingreso en las reservas.</small>`;
      }

      return latestReservations.map(reserva => {
        const createdDate = getReservationCreatedDate(reserva);
        const teacher = formatTeacherShort(reserva.docenteNombre, reserva.docenteCorreo);
        const especialidad = reserva.especialidad || "Sin especialidad";
        const reservationDate = formatShortDate(reserva.fecha);
        const roomName = findRoomInfo(reserva.salon).name;

        return `
          <small class="entryItem"><span class="entryDate">${escapeHtml(formatShortDateTime(createdDate))}</span> · <strong>${escapeHtml(teacher)}</strong> · ${escapeHtml(especialidad)} · Reserva: ${escapeHtml(reservationDate)} · ${escapeHtml(roomName)}</small>
        `;
      }).join("");
    }

function getLatestFirstTimeTeachers(reservas = [], limit = 3) {
      const teachers = new Map();

      reservas.forEach(reserva => {
        const teacherName = formatTeacherShort(reserva.docenteNombre, reserva.docenteCorreo);
        const key = normalizeText(reserva.docenteCorreo || reserva.docenteNombre || teacherName);
        const firstDate = getReservationCreatedDate(reserva);

        if (!key || !teacherName || teacherName === "Sin docente" || !firstDate) return;

        const previous = teachers.get(key);
        if (!previous || firstDate < previous.firstDate) {
          teachers.set(key, {
            teacherName,
            firstDate
          });
        }
      });

      return Array.from(teachers.values())
        .sort((a, b) => b.firstDate - a.firstDate)
        .slice(0, limit);
    }

function renderLatestRegisteredTeachers(reservas = []) {
      const latestTeachers = getLatestFirstTimeTeachers(reservas, 3);

      if (latestTeachers.length === 0) {
        return `<small>Sin datos</small>`;
      }

      return latestTeachers.map(teacher => `<small><strong>${escapeHtml(teacher.teacherName)}</strong> · <span class="teacherDate">${escapeHtml(formatShortDateTime(teacher.firstDate))}</span></small>`).join("");
    }

function renderStats(reservas, reservasTotales = []) {
      const dataForGlobalStats = reservasTotales.length ? reservasTotales : reservas;
      const currentStats = getStats(reservas);
      const globalStats = getStats(dataForGlobalStats);
      const createdToday = countReservationsCreatedToday(dataForGlobalStats);
      const createdThisWeek = countReservationsCreatedThisWeek(dataForGlobalStats);
      const createdThisMonth = countReservationsCreatedThisMonth(dataForGlobalStats);
      document.getElementById("totalReservations").textContent = currentStats.reservations;
      document.getElementById("totalRooms").textContent = currentStats.rooms;
      document.getElementById("totalTeachers").textContent = currentStats.teachers;

document.getElementById("totalReservationsGlobal").innerHTML = `
  Total general: ${globalStats.reservations}
  <div class="weeklyIncomeText">
    <div class="incomeLine">+${createdToday} día</div>
    <div class="incomeLine">+${createdThisWeek} semana</div>
    <div class="incomeLine">+${createdThisMonth} mes</div>
  </div>
`;      document.getElementById("totalRoomsGlobal").innerHTML = renderTopUsedRooms(dataForGlobalStats);
      document.getElementById("totalTeachersGlobal").textContent = `Total general: ${globalStats.teachers}`;
      document.getElementById("latestTeachersInfo").innerHTML = renderLatestRegisteredTeachers(dataForGlobalStats);
      document.getElementById("latestReservationsInfo").innerHTML = renderLatestReservations(dataForGlobalStats);
    }

function renderRoomTags(roomInfo) {
      const tags = [`c${roomInfo.capacity}`];
      tags.push(roomInfo.hasTv ? "TV" : "Sin TV");
      if (roomInfo.accessible) tags.push("Accesible");

      return tags.map(tag => `<span class="miniTag">${escapeHtml(tag)}</span>`).join("");
    }

function renderReservations(reservas, reservasTotales = []) {
      reservationsContainer.innerHTML = "";
      renderStats(reservas, reservasTotales);

      const compactadas = compactReservations(reservas);
      updatePrintInfo(compactadas.length);

      if (compactadas.length === 0) {
        reservationsContainer.innerHTML = `<div class="empty">No hay reservas para los filtros seleccionados.</div>`;
        statusMessage.textContent = "Sin resultados para mostrar.";
        return;
      }

      statusMessage.textContent = `Mostrando ${compactadas.length} fila(s) agrupadas a partir de ${reservas.length} reserva(s).`;

      const grouped = compactadas.reduce((acc, reserva) => {
        if (!acc[reserva.fecha]) acc[reserva.fecha] = [];
        acc[reserva.fecha].push(reserva);
        return acc;
      }, {});

      Object.keys(grouped).sort().forEach(fecha => {
        const reservasDelDia = grouped[fecha].sort(sortByRoom);

        const group = document.createElement("article");
        group.className = "dayGroup";
        group.innerHTML = `
          <div class="dayHeader">
            <h2>${escapeHtml(formatReadableDate(fecha))}</h2>
            <span class="badge">${reservasDelDia.length} espacio(s)</span>
          </div>
          <div class="reservationList"></div>
        `;

        const list = group.querySelector(".reservationList");

        reservasDelDia.forEach(data => {
          const roomInfo = data.roomInfo || findRoomInfo(data.salon);
          const item = document.createElement("article");
          item.className = "reservationItem";
          item.innerHTML = `
            <div class="summaryGrid">
              <div class="roomBlock">
                <strong>${escapeHtml(roomInfo.name)}</strong>
                <div class="roomMeta">${renderRoomTags(roomInfo)}</div>
              </div>

              <div class="mainData">
                <span>Especialidad</span>
                <strong>${escapeHtml(data.especialidades.join(" / "))}</strong>
              </div>

              <div class="mainData">
                <span>Nivel</span>
                <strong>${escapeHtml(data.niveles.join(" / "))}</strong>
              </div>

              <div class="mainData">
                <span>Docente/s</span>
                <small class="smallText">${escapeHtml(data.docentes.join(", "))}</small>
              </div>

              <div class="mainData unitData">
                <span>Unidad curricular</span>
                <small>${escapeHtml(data.unidadesCurriculares.join(" / "))}</small>
              </div>

              <div class="mainData">
                <span>Horario reservado</span>
                <div>${data.horarios.map(horario => `<span class="timePill">${escapeHtml(horario)}</span>`).join("")}</div>
              </div>
            </div>
          `;
          list.appendChild(item);
        });

        reservationsContainer.appendChild(group);
      });
    }

function updatePrintInfo(total) {
      const filters = [];

      const selectedRange = getSelectedDateRange();

      if (dateModeFilter.value === "all") {
        filters.push("Fechas: todas las reservas");
      } else if (selectedRange.from || selectedRange.to) {
        filters.push(`Fechas: ${selectedRange.from ? formatReadableDate(selectedRange.from) : "inicio"} a ${selectedRange.to ? formatReadableDate(selectedRange.to) : "fin"}`);
      }

      if (roomFilter.value) {
        filters.push(`Salón: ${roomFilter.options[roomFilter.selectedIndex].textContent}`);
      }

      if (searchFilter.value.trim()) {
        filters.push(`Búsqueda: ${searchFilter.value.trim()}`);
      }

      const filterText = filters.length > 0 ? filters.join(" · ") : "Sin filtros aplicados";
      printInfo.textContent = `CERP del Litoral · Sede Salto · ${total} reserva(s) · ${filterText}`;
    }

function showLoadingState() {
      statusMessage.className = "message";
      statusMessage.textContent = "Cargando reservas...";

      if (statsContainer) {
        statsContainer.classList.add("isLoading");
      }

      reservationsContainer.innerHTML = `
        <div class="loadingBox" aria-label="Cargando datos">
          <div class="loadingCard"></div>
          <div class="loadingCard"></div>
          <div class="loadingCard"></div>
        </div>
      `;
    }

function hideLoadingState() {
      if (statsContainer) {
        statsContainer.classList.remove("isLoading");
      }
    }

async function loadReservations() {
      showLoadingState();

      try {
        let q;
        const selectedRange = getSelectedDateRange();
        const selectedFromDate = selectedRange.from;
        const selectedToDate = selectedRange.to;

        if (selectedFromDate && selectedToDate) {
          q = query(collection(db, "reservas"), where("fecha", ">=", selectedFromDate), where("fecha", "<=", selectedToDate));
        } else if (selectedFromDate) {
          q = query(collection(db, "reservas"), where("fecha", ">=", selectedFromDate));
        } else if (selectedToDate) {
          q = query(collection(db, "reservas"), where("fecha", "<=", selectedToDate));
        } else {
          q = query(collection(db, "reservas"));
        }

        const [snapshot, totalSnapshot] = await Promise.all([
          getDocs(q),
          getDocs(collection(db, "reservas"))
        ]);

        let reservas = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(isVisibleReservation);

        const reservasTotales = totalSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(isVisibleReservation);

        const selectedRoom = roomFilter.value;
        const search = normalizeText(searchFilter.value);

        if (selectedRoom) {
          reservas = reservas.filter(r => findRoomInfo(r.salon).name === selectedRoom);
        }

        if (search) {
          reservas = reservas.filter(r => {
            const roomInfo = findRoomInfo(r.salon);
            const fullText = normalizeText([
              r.docenteNombre,
              r.docenteCorreo,
              r.docenteCedula,
              r.grupo,
              r.nivel,
              r.especialidad,
              r.unidadCurricular,
              r.salon,
              roomInfo.capacity,
              roomInfo.hasTv ? "tv" : "sin tv",
              roomInfo.accessible ? "accesible" : "",
              Array.isArray(r.horarios) ? r.horarios.join(" ") : ""
            ].join(" "));
            return fullText.includes(search);
          });
        }

        reservas.sort((a, b) => {
          const fechaCompare = String(a.fecha).localeCompare(String(b.fecha));
          if (fechaCompare !== 0) return fechaCompare;

          const horarioA = Array.isArray(a.horarios) ? a.horarios[0] : "";
          const horarioB = Array.isArray(b.horarios) ? b.horarios[0] : "";
          return horarioA.localeCompare(horarioB) || String(a.salon).localeCompare(String(b.salon), "es", { numeric: true });
        });

        hideLoadingState();
        renderReservations(reservas, reservasTotales);
      } catch (error) {
        hideLoadingState();
        console.error("Error al cargar reservas:", error);
        statusMessage.className = "message error";
        statusMessage.textContent = "Error al cargar reservas: " + error.message;
      }
    }

function printReservations() {
      window.print();
    }

window.loadReservations = loadReservations;
    window.printReservations = printReservations;

    dateModeFilter.addEventListener("change", () => {
      updateDateModeView();
      loadReservations();
    });
    weekendFilter.addEventListener("change", loadReservations);
    roomFilter.addEventListener("change", loadReservations);
    fromDateFilter.addEventListener("change", loadReservations);
    toDateFilter.addEventListener("change", loadReservations);
    searchFilter.addEventListener("input", () => {
      clearTimeout(window.__searchTimer);
      window.__searchTimer = setTimeout(loadReservations, 350);
    });

    populateWeekendFilter();
    updateDateModeView();

    const defaultWeek = getNextFridayAndSaturday();
    fromDateFilter.value = defaultWeek.friday;
    toDateFilter.value = defaultWeek.saturday;

    loadReservations();
