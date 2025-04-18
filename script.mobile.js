// Chargement des releases
document.addEventListener('DOMContentLoaded', function() {
    loadReleases();
});

function loadReleases() {
    fetch('releases.json')
        .then(response => response.json())
        .then(data => {
            const container = document.querySelector('.releases-container');
            data.releases.forEach(release => {
                const releaseElement = createReleaseElement(release);
                container.appendChild(releaseElement);
            });
        })
        .catch(error => console.error('Erreur lors du chargement des releases:', error));
}

function createReleaseElement(release) {
    const div = document.createElement('div');
    div.className = 'release-iframe';
    
    const cover = document.createElement('div');
    cover.className = 'release-cover';
    
    const img = document.createElement('img');
    img.src = release.cover;
    img.alt = release.title;
    
    cover.appendChild(img);
    div.appendChild(cover);
    
    return div;
} 