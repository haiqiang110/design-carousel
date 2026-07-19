class ParallaxTransition {
    constructor() {
        this.scrollContainer = document.getElementById('scrollContainer');
        this.whiteWipe = document.getElementById('whiteWipe');
        this.fixedText = document.querySelector('.fixed-text');
        this.strikeLine = document.querySelector('.strike-line');
        this.pageImages = document.querySelector('.page[data-page="0"] .page-images');
        this.pageImages2 = document.querySelector('.page[data-page="1"] .page-content-image');
        this.cardPages = document.querySelectorAll('.page--cards');
        this.page1 = document.querySelector('.page[data-page="0"]');
        this.pages = document.querySelectorAll('.page');
        
        this.page1Progress = 0;
        this.strikeTriggered = false;
        this.imagesEntered = false;
        this.page2Progress = 0;
        
        this.setupScrollListener();
        this.setupImageObserver();
        this.update();
        
        if (this.fixedText) {
            setTimeout(() => {
                this.fixedText.style.opacity = '1';
            }, 200);
        }
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
    
    setupImageObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const img = entry.target.querySelector('.page-content-image');
                const isCardPage = entry.target.classList.contains('page--cards');
                if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                    if (img && entry.target.dataset.page === '1') {
                        img.classList.add('visible');
                    }
                    if (isCardPage) {
                        entry.target.classList.add('is-visible');
                    }
                } else {
                    if (img && entry.target.dataset.page === '1') {
                        img.classList.remove('visible');
                    }
                }
            });
        }, {
            root: this.scrollContainer,
            threshold: [0, 0.3, 0.5, 0.85, 1]
        });
        
        this.pages.forEach((page) => {
            observer.observe(page);
        });
    }
    
    update() {
        const scrollY = this.scrollContainer.scrollTop;
        const pageHeight = window.innerHeight;
        const page1Height = this.page1.offsetHeight;
        const page1Scroll = Math.min(scrollY, page1Height - pageHeight);
        this.page1Progress = page1Scroll / (page1Height - pageHeight);
        this.page1Progress = Math.max(0, Math.min(1, this.page1Progress));
        
        const page2Scroll = scrollY - (page1Height - pageHeight);
        this.page2Progress = page2Scroll / pageHeight;
        this.page2Progress = Math.max(0, Math.min(1, this.page2Progress));
        
        this.updateStrikeLine(this.page1Progress);
        this.updateImages(this.page1Progress);
        this.updateTextParallax(scrollY / pageHeight);
        this.updateTextOpacity(this.page2Progress);
    }
    
    updateStrikeLine(progress) {
        if (!this.strikeLine) return;
        
        const strikeProgress = this.mapRange(progress, 0.1, 0.4, 0, 1);
        const clamped = Math.max(0, Math.min(1, strikeProgress));
        const eased = this.easeOutCubic(clamped);
        
        this.strikeLine.style.width = (eased * 100) + '%';
    }
    
    updateImages(progress) {
        if (!this.pageImages) return;
        
        const enterProgress = this.mapRange(progress, 0.3, 0.7, 0, 1);
        const clamped = Math.max(0, Math.min(1, enterProgress));
        
        if (clamped > 0 && !this.imagesEntered) {
            this.pageImages.classList.add('is-enter');
            this.imagesEntered = true;
        } else if (clamped === 0 && this.imagesEntered) {
            this.pageImages.classList.remove('is-enter');
            this.imagesEntered = false;
        }
    }
    
    updateTextParallax(progress) {
        if (!this.fixedText) return;
        
        const yOffset = -progress * 30;
        this.fixedText.style.transform = `translate(0, calc(-50% + ${yOffset}px))`;
    }
    
    updateTextOpacity(page2Progress) {
        if (!this.fixedText) return;
        
        const fadeProgress = this.mapRange(page2Progress, 0, 0.5, 1, 0);
        const clamped = Math.max(0, Math.min(1, fadeProgress));
        this.fixedText.style.opacity = clamped;
    }
    
    mapRange(value, inMin, inMax, outMin, outMax) {
        return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ParallaxTransition();
});
