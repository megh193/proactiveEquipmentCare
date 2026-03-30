/* dark_mode.js */
document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    const darkModeBtns = document.querySelectorAll('.dark-mode-btn');
    updateDarkModeIcons(isDarkMode);

    darkModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            updateDarkModeIcons(isDark);
            
            // Re-render charts or other canvas elements if necessary:
            if(window.Chart) {
                Chart.instances.forEach(chart => {
                    chart.options.plugins.legend.labels.color = isDark ? '#F8FAFC' : '#1E293B';
                    if(chart.options.scales && chart.options.scales.x) {
                        chart.options.scales.x.ticks.color = isDark ? '#94A3B8' : '#64748B';
                    }
                    if(chart.options.scales && chart.options.scales.y) {
                        chart.options.scales.y.ticks.color = isDark ? '#94A3B8' : '#64748B';
                    }
                    chart.update();
                });
            }
        });
    });

    function updateDarkModeIcons(isDark) {
        darkModeBtns.forEach(btn => {
            const hasTextContent = btn.textContent.trim().length > 0;
            const isFontAwesome = btn.innerHTML.includes('fa-') || (!btn.innerHTML.includes('svg') && btn.innerHTML.includes('fa-'));
            
            if (isFontAwesome) {
                if (isDark) {
                    btn.innerHTML = `<i class="fa-solid fa-sun"></i>${hasTextContent ? ' Light Mode' : ''}`;
                } else {
                    btn.innerHTML = `<i class="fa-solid fa-moon"></i>${hasTextContent ? ' Dark Mode' : ''}`;
                }
            } else {
                if (isDark) {
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    ${hasTextContent ? 'Light Mode' : ''}`.trim();
                } else {
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    ${hasTextContent ? 'Dark Mode' : ''}`.trim();
                }
            }
        });
    }
});
