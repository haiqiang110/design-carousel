class ParallaxTransition {
    constructor() {
        this.scrollContainer = document.getElementById('scrollContainer');
        this.whiteWipe = document.getElementById('whiteWipe');
        this.parallaxBgs = document.querySelectorAll('.parallax-bg');
        this.fixedTexts = document.querySelectorAll('.fixed-text');
        this.pages = document.querySelectorAll('.page');
        this.totalPages = this.pages.length;
        
        this.imageParallax = 0.1;
        this.textParallaxAmount = 50;
        this.textRange = 0.7;
        
        this.setupScrollListener();
        this.update();
    }
    
    setupScrollListener() {
        let ticking = false;
        
        this.scrollContainer.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.update();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }
    
    update() {
        const scrollY = this.scrollContainer.scrollTop;
        const pageHeight = window.innerHeight;
        const progress = scrollY / pageHeight;
        
        this.updateParallax(progress);
        this.updateFixedText(progress);
    }
    
    updateParallax(progress) {
        this.parallaxBgs.forEach((bg, index) => {
            const pageY = (index - progress) * 100;
            bg.style.transform = `translateY(${pageY}%)`;
            
            const mediaEl = bg.querySelector('video') || bg.querySelector('img:not(.mask-overlay)');
            if (mediaEl) {
                const localProgress = progress - index;
                const imgOffset = localProgress * this.imageParallax * 100;
                mediaEl.style.transform = `translateY(${imgOffset}%)`;
            }
        });
    }
    
    updateFixedText(progress) {
        this.fixedTexts.forEach((textEl) => {
            const textIndex = parseInt(textEl.dataset.textIndex);
            const localProgress = progress - textIndex;
            const absProgress = Math.abs(localProgress);
            
            if (absProgress >= this.textRange) {
                textEl.style.opacity = '0';
                textEl.style.transform = 'translate(0, -50%)';
                return;
            }
            
            const opacity = 1 - (absProgress / this.textRange);
            const yOffset = -localProgress * (this.textParallaxAmount / this.textRange);
            
            textEl.style.opacity = opacity;
            textEl.style.transform = `translate(0, calc(-50% + ${yOffset}px))`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ParallaxTransition();
});