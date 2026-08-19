/**
 * Formatea cualquier fecha a DD/MM/AAAA.
 * Acepta: string ISO (YYYY-MM-DD…), Date object, o null/undefined → '—'
 */
export const formatFecha = (d) => {
    if (!d) return '—';
    try {
        // Si es string tipo YYYY-MM-DD (fecha de BD), parsear directo para evitar desfase de zona horaria
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
            const [year, month, day] = d.substring(0, 10).split('-');
            return `${day}/${month}/${year}`;
        }
        const date = d instanceof Date ? d : new Date(d);
        if (isNaN(date.getTime())) return '—';
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch { return '—'; }
};