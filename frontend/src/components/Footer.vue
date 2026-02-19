<template>
    <footer class="footer">
        <div class="footer-info">
            <span class="footer-copyright">&copy; {{ new Date().getFullYear() }} <a href="https://krisztiankozari.dev/" target="_blank" rel="noopener noreferrer">Krisztian Kozari</a>. All rights reserved.</span>
        </div>
        <img src="@/assets/bottleskyline-dark.svg" alt="Beers" class="footer-skyline" />
    </footer>    
</template>

<style scoped>
.footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding-top: 2rem;
    z-index: 1;
}

.footer-info {
    font-size: var(--font-size-sm);
    color: var(--gray-9);
}

.footer-info a {
    color: var(--green-9);
    text-decoration: none;
    transition: color 0.2s ease;
}

.footer-info a:hover {
    color: var(--green-11);
}

.footer-skyline {
    display: block;
    width: 100vw;
    max-width: 100vw;
    margin-left: calc(-50vw + 50%);
}
</style>
