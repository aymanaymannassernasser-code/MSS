// Global Theme Manager - Shared across all pages
(function() {
    // Apply saved theme immediately to prevent flash
    const savedTheme = localStorage.getItem('motorSimTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update toggle button icon when DOM loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateThemeIcon);
    } else {
        updateThemeIcon();
    }
})();

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('motorSimTheme', newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    toggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    toggle.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}
