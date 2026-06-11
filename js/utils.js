// Funciones generales reutilizables.

export function formatReadableDate(dateText) {
      const date = new Date(dateText + "T00:00:00");
      return date.toLocaleDateString("es-UY", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

export function formatCompactWeekend(fridayText, saturdayText) {
      const friday = new Date(fridayText + "T00:00:00");
      const saturday = new Date(saturdayText + "T00:00:00");

      const fridayDay = friday.getDate();
      const saturdayDay = saturday.getDate();
      const fridayMonth = String(friday.getMonth() + 1).padStart(2, "0");
      const saturdayMonth = String(saturday.getMonth() + 1).padStart(2, "0");
      const fridayYear = friday.getFullYear();
      const saturdayYear = saturday.getFullYear();

      if (fridayMonth === saturdayMonth && fridayYear === saturdayYear) {
        return `${fridayDay} y ${saturdayDay} del ${fridayMonth} / ${fridayYear}`;
      }

      if (fridayYear === saturdayYear) {
        return `${fridayDay}/${fridayMonth} y ${saturdayDay}/${saturdayMonth} / ${fridayYear}`;
      }

      return `${fridayDay}/${fridayMonth}/${fridayYear} y ${saturdayDay}/${saturdayMonth}/${saturdayYear}`;
    }

export function normalizeText(text) {
      return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

export function escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

export function getUnifiedTime(horarios) {
      if (!Array.isArray(horarios) || horarios.length === 0) return "Sin horario";
      if (horarios.length === 1) return horarios[0];

      const firstStart = String(horarios[0]).split(" - ")[0];
      const lastEnd = String(horarios[horarios.length - 1]).split(" - ")[1];
      return `${firstStart} - ${lastEnd || ""}`.trim();
    }

export function getLevel(data) {
      return data.nivel || data.grupo || "No registrado";
    }

export function uniqueValues(values) {
      const seen = new Set();
      return values
        .map(value => String(value || "").trim())
        .filter(value => {
          if (!value || seen.has(normalizeText(value))) return false;
          seen.add(normalizeText(value));
          return true;
        });
    }

export function formatTeacherShort(name, email) {
      const cleanName = String(name || "").trim();
      if (!cleanName) return String(email || "Sin docente").trim();

      const parts = cleanName.split(/\s+/);
      if (parts.length === 1) return parts[0];

      if (parts.length === 2) {
        const initial = parts[0].charAt(0).toUpperCase() + ".";
        return `${initial} ${parts[1]}`;
      }

      const surnameIndex = Math.floor(parts.length / 2);
      const selectedName = parts[surnameIndex - 1];
      const surnames = parts.slice(surnameIndex).join(" ");
      const initial = selectedName.charAt(0).toUpperCase() + ".";

      return `${initial} ${surnames}`;
    }

export function formatTeachers(teacherText, email) {
      const cleanTeacherText = String(teacherText || "").trim();

      if (!cleanTeacherText) {
        return [formatTeacherShort("", email)];
      }

      return cleanTeacherText
        .split("/")
        .map(teacherName => formatTeacherShort(teacherName.trim(), email))
        .filter(teacherName => teacherName && teacherName !== "Sin docente");
    }

export function toDateInputValue(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

export function addDays(dateText, amount) {
      const date = new Date(dateText + "T00:00:00");
      date.setDate(date.getDate() + amount);
      return toDateInputValue(date);
    }

export function getNextFridayAndSaturday(baseDate = new Date()) {
      const today = new Date(baseDate);
      today.setHours(0, 0, 0, 0);

      const day = today.getDay();
      let daysUntilFriday = (5 - day + 7) % 7;

      // Si ya es sábado o domingo, se muestra el próximo viernes-sábado.
      if (day === 6 || day === 0) {
        daysUntilFriday = day === 6 ? 6 : 5;
      }

      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);

      const saturday = new Date(friday);
      saturday.setDate(friday.getDate() + 1);

      return {
        friday: toDateInputValue(friday),
        saturday: toDateInputValue(saturday)
      };
    }

export function formatShortDate(dateText) {
      if (!dateText) return "Sin fecha";
      const date = new Date(dateText + "T00:00:00");
      return date.toLocaleDateString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    }

export function formatShortDateTime(date) {
      if (!date) return "Sin ingreso";

      const day = date.getDate();
      const month = date.getMonth() + 1;
      const time = date.toLocaleTimeString("es-UY", {
        hour: "2-digit",
        minute: "2-digit"
      }).toLowerCase();

      return `${day}/${month}, ${time}`;
    }
