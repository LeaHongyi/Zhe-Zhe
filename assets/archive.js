
    const lightbox = document.querySelector(".lightbox");
    const lightboxImage = lightbox.querySelector("img");
    const lightboxIndex = lightbox.querySelector(".lightbox-index");
    const lightboxDownload = lightbox.querySelector(".lightbox-download");
    const lightboxPrev = lightbox.querySelector(".lightbox-prev");
    const lightboxNext = lightbox.querySelector(".lightbox-next");
    const lightboxCaption = lightbox.querySelector(".lightbox-caption");
    const lightboxCaptionTime = lightboxCaption.querySelector("time");
    const lightboxCaptionText = lightboxCaption.querySelector("p");
    const setupCrossfade = (container, layerSelector, images, intervalMs) => {
      const layers = [...container.querySelectorAll(layerSelector)];
      if (layers.length < 2 || images.length < 2) return;
      if ('IntersectionObserver' in window) {
        const visibility = new IntersectionObserver(entries => { container.dataset.onScreen = entries[0].isIntersecting ? '1' : ''; });
        visibility.observe(container);
      } else { container.dataset.onScreen = '1'; }
      let activeLayer = 0;
      const imageSrc = (image) => typeof image === "string" ? image : image.src;
      const imagePost = (image) => typeof image === "string" ? "" : image.post;
      let currentImageSource = imageSrc(images[0]);
      window.setInterval(() => {
        if (document.hidden || !container.dataset.onScreen) return;
        const candidates = images.filter((image) => imageSrc(image) !== currentImageSource);
        const next = candidates[Math.floor(Math.random() * candidates.length)] || images[0];
        const nextSource = imageSrc(next);
        const nextLayer = activeLayer === 0 ? 1 : 0;
        const preload = new Image();
        preload.onload = () => {
          layers[nextLayer].style.backgroundImage = "url('" + nextSource + "')";
          layers[nextLayer].dataset.post = imagePost(next);
          layers[nextLayer].classList.add("active");
          layers[activeLayer].classList.remove("active");
          activeLayer = nextLayer;
          currentImageSource = nextSource;
        };
        preload.src = nextSource;
      }, intervalMs);
    };
    const hero = document.querySelector(".hero");
    if (hero) {
      let heroImages = [];
      try {
        heroImages = JSON.parse(hero.dataset.images || "[]");
      } catch (_) {
        heroImages = [];
      }
      setupCrossfade(hero, ".hero-bg", heroImages, 4600);
      hero.addEventListener("click", (event) => {
        if (event.target.closest(".start-button")) return;
        const activeLayer = hero.querySelector(".hero-bg.active");
        const target = activeLayer?.dataset.post
          ? document.getElementById(activeLayer.dataset.post)
          : null;
        if (target) jumpToPost(target);
      });
    }
    document.querySelector(".start-button").addEventListener("click", (event) => {
      event.preventDefault();
      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
      const target = document.querySelector(".collections");
      if (!target) return;
      history.replaceState(null, "", "#collections");
      window.scrollTo({
        top: window.scrollY + target.getBoundingClientRect().top - headerHeight,
        behavior: "smooth",
      });
    });
    const getHeaderHeight = () =>
      document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
    const snapCollections = document.querySelector(".collections");
    const snapArchive = document.querySelector("#archive-content");
    let snapLockUntil = 0;
    let snapFinishTimer = 0;
    const snapToTop = (top, hash = "") => {
      if (hash) {
        history.replaceState(null, "", hash);
      } else if (top === 0) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      const scrollRoot = document.scrollingElement || document.documentElement;
      snapLockUntil = performance.now() + 760;
      const targetTop = Math.max(0, Math.round(top));
      scrollRoot.scrollTo({ top: targetTop, behavior: "smooth" });
      window.scrollTo({ top: targetTop, behavior: "smooth" });
      clearTimeout(snapFinishTimer);
      snapFinishTimer = window.setTimeout(() => {
        scrollRoot.scrollTop = targetTop;
        window.scrollTo(0, targetTop);
      }, 780);
    };
    const snapToElement = (element, hash) => {
      if (!element) return;
      snapToTop(element.offsetTop - getHeaderHeight(), hash);
    };
    const handleSectionSnap = (deltaY) => {
      if (!snapCollections || !snapArchive || Math.abs(deltaY) < 8) return false;
      if (performance.now() < snapLockUntil) return true;
      const headerHeight = getHeaderHeight();
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const collectionsTop = Math.max(0, snapCollections.offsetTop - headerHeight);
      const archiveTop = Math.max(0, snapArchive.offsetTop - headerHeight);
      const nearCollections = Math.abs(y - collectionsTop) < 96;
      const nearArchive = Math.abs(y - archiveTop) < 96;
      if (deltaY > 0) {
        if (y < collectionsTop - 24) {
          snapToElement(snapCollections, "#collections");
          return true;
        }
        if (y < archiveTop - 24 && (nearCollections || y >= collectionsTop - 24)) {
          snapToElement(snapArchive, "#archive-content");
          return true;
        }
        return false;
      }
      if (nearArchive && y > collectionsTop + 24) {
        snapToElement(snapCollections, "#collections");
        return true;
      }
      if ((nearCollections || y < collectionsTop + 96) && y > 8) {
        snapToTop(0, "");
        return true;
      }
      return false;
    };
    window.addEventListener("wheel", (event) => {
      if (handleSectionSnap(event.deltaY)) event.preventDefault();
    }, { passive: false });
    let sectionTouchStartY = 0;
    window.addEventListener("touchstart", (event) => {
      sectionTouchStartY = event.changedTouches[0].clientY;
    }, { passive: true });
    window.addEventListener("touchmove", (event) => {
      const deltaY = sectionTouchStartY - event.changedTouches[0].clientY;
      if (Math.abs(deltaY) < 42) return;
      if (handleSectionSnap(deltaY)) {
        event.preventDefault();
        sectionTouchStartY = event.changedTouches[0].clientY;
      }
    }, { passive: false });
    document.querySelectorAll(".collection-card").forEach((card, cardIndex) => {
      let images = [];
      try {
        images = JSON.parse(card.dataset.images || "[]");
      } catch (_) {
        images = [];
      }
      if (images.length > 1) {
        setupCrossfade(card, ".collection-bg", images, 3600 + cardIndex * 520);
      }
    });
    const galleries = [...document.querySelectorAll(".post")].map((post) =>
      [...post.querySelectorAll(".photo-open")]
    );
    let albumButtons = [...document.querySelectorAll(".album-open")];
    let activeLightboxButtons = null;
    let currentGallery = 0;
    let currentImage = 0;
    let touchStartX = 0;
    const loadPhoto = (button) => {
      const image = button.querySelector("img");
      if (!image.getAttribute("src")) image.src = button.dataset.thumb || button.dataset.src;
      pendingButtons.delete(button);
      return image;
    };
    const lazyButtons = [...document.querySelectorAll(".photo-open, .album-open")];
    const pendingButtons = new Set(lazyButtons);
    let photoLoadTicking = false;
    let photoObserver = null;
    const loadVisiblePhotos = () => {
      if (photoObserver) return;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const preload = 1100;
      pendingButtons.forEach((button) => {
        if (button.closest("[hidden]")) return;
        if (button.closest(".post")?.hidden) return;
        if (button.closest(".album-item")?.hidden) return;
        const image = button.querySelector("img");
        if (image.getAttribute("src")) return;
        const rect = button.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.bottom >= -preload && rect.top <= viewportHeight + preload) {
          loadPhoto(button);
        }
      });
    };
    const requestVisiblePhotoLoad = () => {
      if (photoLoadTicking) return;
      photoLoadTicking = true;
      requestAnimationFrame(() => {
        photoLoadTicking = false;
        loadVisiblePhotos();
      });
    };
    const loadAroundPost = (post) => {
      if (!post) return;
      post.querySelectorAll(".photo-open").forEach(loadPhoto);
      let sibling = post.nextElementSibling;
      for (let index = 0; sibling && index < 2; index += 1, sibling = sibling.nextElementSibling) {
        sibling.querySelectorAll(".photo-open").forEach(loadPhoto);
      }
    };
    const layout = document.querySelector(".layout");
    const albumView = document.querySelector(".album-view");
    const viewButtons = [...document.querySelectorAll(".view-action")];
    let archiveView = "posts";
    const setArchiveView = async (view, scrollToArchive = true) => {
      archiveView = view;
      const isAlbum = view === "album";
      if (layout) layout.hidden = isAlbum;
      if (albumView) albumView.hidden = !isAlbum;
      if (isAlbum) await ensureAlbum();
      if (archiveView !== view) return;
      viewButtons.forEach((button) => {
        const active = button.dataset.view === view;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (scrollToArchive) {
        const target = document.querySelector("#archive-content");
        if (target) snapToElement(target, "#archive-content");
      }
      requestAnimationFrame(() => {
        requestVisiblePhotoLoad();
        if (typeof updateBackToTop === "function") updateBackToTop();
      });
    };
    viewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setArchiveView(button.dataset.view || "posts");
      });
    });
    function jumpToPost(post) {
      if (!post) return;
      clearTimeout(snapFinishTimer); snapLockUntil = 0;
      if (archiveView === "album") setArchiveView("posts", false);
      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
      const toolbarHeight = document.querySelector(".archive-toolbar")?.getBoundingClientRect().height || 0;
      history.replaceState(null, "", "#" + post.id);
      const scrollRoot = document.scrollingElement || document.documentElement;
      const applyScroll = () => {
        const top = Math.max(0, post.offsetTop - headerHeight - toolbarHeight - 12);
        scrollRoot.scrollTo({top, behavior:"instant"});
        window.scrollTo({top, behavior:"instant"});
      };
      applyScroll();
      window.setTimeout(applyScroll, 0);
      window.setTimeout(applyScroll, 120);
      window.setTimeout(applyScroll, 420);
      loadAroundPost(post);
      requestAnimationFrame(() => {
        applyScroll();
        requestVisiblePhotoLoad();
        setActiveTimeline(post.id, false);
      });
    }
    document.querySelector(".collection-grid")?.addEventListener("click", (event) => {
      const card = event.target.closest(".collection-card");
      if (!card) return;
      const target = document.getElementById(card.dataset.target);
      if (!target) return;
      event.preventDefault();
      jumpToPost(target);
    }, true);
    if ("IntersectionObserver" in window) {
      photoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          loadPhoto(entry.target);
          photoObserver.unobserve(entry.target);
        });
      }, { rootMargin: "900px 0px" });
      lazyButtons.forEach((button) => photoObserver.observe(button));
    } else {
      lazyButtons.slice(0, 80).forEach(loadPhoto);
      window.addEventListener("scroll", requestVisiblePhotoLoad, { passive: true });
    }
    loadVisiblePhotos();
    const showLightboxImage = () => {
      const buttons = activeLightboxButtons || galleries[currentGallery];
      const button = buttons[currentImage];
      const image = loadPhoto(button);
      lightboxImage.src = button.dataset.src;
      lightboxIndex.textContent = (currentImage + 1) + "/" + buttons.length;
      lightboxDownload.href = button.dataset.src;
      lightboxDownload.download = button.dataset.filename;
      lightboxPrev.disabled = currentImage === 0;
      lightboxNext.disabled = currentImage === buttons.length - 1;
      lightboxCaptionTime.textContent = button.dataset.time || "";
      lightboxCaptionText.textContent = button.dataset.caption || "";
      lightboxCaption.classList.toggle("visible", Boolean(button.dataset.caption || button.dataset.time));
    };
    const moveLightbox = (step) => {
      const next = currentImage + step;
      const buttons = activeLightboxButtons || galleries[currentGallery];
      if (next < 0 || next >= buttons.length) return;
      currentImage = next;
      showLightboxImage();
    };
    const closeLightbox = () => {
      lightbox.classList.remove("open");
      lightboxImage.removeAttribute("src");
      activeLightboxButtons = null;
    };
    document.querySelectorAll(".photo-open").forEach((button) => {
      button.addEventListener("click", () => {
        activeLightboxButtons = null;
        currentGallery = Number(button.dataset.post);
        currentImage = Number(button.dataset.image);
        showLightboxImage();
        lightbox.classList.add("open");
      });
    });
    const bindAlbumButtons = () => {
    albumButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        activeLightboxButtons = albumButtons.filter((item) => !item.closest(".album-item")?.hidden);
        currentImage = Math.max(0, activeLightboxButtons.indexOf(button));
        showLightboxImage();
        lightbox.classList.add("open");
      });
    });
    };
    bindAlbumButtons();
    document.querySelectorAll(".date-month-jump").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const target = document.getElementById(button.dataset.target);
        button.closest(".date-month")?.setAttribute("open", "");
        button.closest(".date-year")?.setAttribute("open", "");
        if (target) {
          jumpToPost(target);
        }
      });
    });
    const dateEntries = [...document.querySelectorAll(".date-entry")];
    const navigationItems = [...dateEntries];
    const navigationByPost = new Map(navigationItems.map((item) => [item.dataset.post, item]));
    let activeTimelineId = "";
    let activeTimelineItem = null;
    const setActiveTimeline = (id, scrollActive = false) => {
      if (activeTimelineId === id) return;
      activeTimelineItem?.classList.remove("active");
      const active = navigationByPost.get(id);
      activeTimelineId = id;
      activeTimelineItem = active || null;
      if (active) {
        active.classList.add("active");
        active.closest("details")?.setAttribute("open", "");
        active.closest(".date-year")?.setAttribute("open", "");
        if (scrollActive) active.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    const postElements = [...document.querySelectorAll(".post")];
    let albumItems = [...document.querySelectorAll(".album-item")];
    let visiblePostElements = postElements;
    navigationItems.forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(item.dataset.post);
        jumpToPost(target);
      });
    });
    document.querySelectorAll(".comments-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const panel = document.getElementById(button.getAttribute("aria-controls"));
        const opening = panel.hidden;
        panel.hidden = !opening;
        button.setAttribute("aria-expanded", String(opening));
      });
    });
    document.querySelectorAll(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter;
        document.querySelectorAll(".filter-button").forEach((item) =>
          item.classList.toggle("filter-active", item === button)
        );
        postElements.forEach((post) => {
          post.hidden = filter !== "all" && !post.dataset.categories.split(" ").includes(filter);
        });
        dateEntries.forEach((item) => {
          item.hidden = filter !== "all" && !item.dataset.categories.split(" ").includes(filter);
        });
        albumItems.forEach((item) => {
          item.hidden = filter !== "all" && !item.dataset.categories.split(" ").includes(filter);
        });
        visiblePostElements = postElements.filter((post) => !post.hidden);
        document.querySelectorAll(".date-month").forEach((month) => {
          month.hidden = ![...month.querySelectorAll(".date-entry")].some((item) => !item.hidden);
        });
        document.querySelectorAll(".date-year").forEach((year) => {
          year.hidden = ![...year.querySelectorAll(".date-month")].some((month) => !month.hidden);
        });
        document.querySelectorAll(".album-month").forEach((month) => {
          month.hidden = ![...month.querySelectorAll(".album-item")].some((item) => !item.hidden);
        });
        document.querySelectorAll(".album-year").forEach((year) => {
          year.hidden = ![...year.querySelectorAll(".album-month")].some((month) => !month.hidden);
        });
        const firstVisible = postElements.find((post) => !post.hidden);
        if (archiveView === "album") {
          snapToElement(document.querySelector("#archive-content"), "#archive-content");
          requestVisiblePhotoLoad();
        } else if (firstVisible) {
          jumpToPost(firstVisible);
        }
      });
    });
    let scrollTicking = false;
    let lastTimelineSync = 0;
    const syncTimeline = () => {
      lastTimelineSync = performance.now();
      const marker = window.innerHeight * .34;
      const visiblePosts = visiblePostElements;
      if (!visiblePosts.length) {
        scrollTicking = false;
        return;
      }
      let low = 0, high = visiblePosts.length - 1, current = visiblePosts[0];
      while (low <= high) {
        const middle = (low + high) >>> 1;
        if (visiblePosts[middle].getBoundingClientRect().top <= marker) {
          current = visiblePosts[middle]; low = middle + 1;
        } else { high = middle - 1; }
      }
      setActiveTimeline(current.id, false);
      scrollTicking = false;
    };
    const requestTimelineSync = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        if (performance.now() - lastTimelineSync < 80) {
          scrollTicking = false;
          return;
        }
        syncTimeline();
      });
    };
    const backToTop = document.querySelector(".back-to-top");
    const updateBackToTop = () => {
      if (!backToTop) return;
      const threshold = Math.max(window.innerHeight * 1.6, 1200);
      backToTop.classList.toggle("visible", window.scrollY > threshold);
    };
    backToTop?.addEventListener("click", () => {
      snapToTop(0, "");
    });
    window.addEventListener("scroll", requestTimelineSync, { passive: true });
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    window.addEventListener("resize", requestTimelineSync);
    window.addEventListener("resize", requestVisiblePhotoLoad);
    syncTimeline();
    updateBackToTop();
    lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    lightboxPrev.addEventListener("click", () => moveLightbox(-1));
    lightboxNext.addEventListener("click", () => moveLightbox(1));
    lightboxImage.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    lightboxImage.addEventListener("touchend", (event) => {
      const delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 45) moveLightbox(delta < 0 ? 1 : -1);
    }, { passive: true });
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLightbox();
      if (!lightbox.classList.contains("open")) return;
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
    });
  
    // Load the editor only when requested, over the existing page and scroll position.
    let publisherFrame = null;
    let publisherTrigger = null;
    let previousBodyOverflow = '';
    let publisherBackground = [];
    const closePublisher = (published = false) => {
      publisherFrame?.remove(); publisherFrame = null;
      document.body.style.overflow = previousBodyOverflow;
      publisherBackground.forEach(([element, wasInert]) => { element.inert = wasInert; }); publisherBackground = [];
      publisherTrigger?.focus({preventScroll:true});
      if (published) {
        const toast = document.createElement('div'); toast.className = 'archive-publish-toast';
        toast.textContent = '发布成功，笔记已公开'; document.body.append(toast);
        setTimeout(() => toast.remove(), 3500);
      }
    };
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-publish]');
      if (!trigger) return;
      event.preventDefault();
      if (publisherFrame) return;
      publisherTrigger = trigger; previousBodyOverflow = document.body.style.overflow;
      publisherFrame = document.createElement('iframe'); publisherFrame.className = 'archive-publisher-frame';
      publisherFrame.title = '发布新笔记'; publisherFrame.src = 'notes.html?embed=1&compose=1';
      publisherBackground = [...document.body.children].filter(element => element.tagName !== 'SCRIPT').map(element => [element, element.inert]);
      publisherBackground.forEach(([element]) => { element.inert = true; });
      document.body.style.overflow = 'hidden'; document.body.append(publisherFrame);
    });
    window.addEventListener('message', (event) => {
      if (!publisherFrame || event.origin !== location.origin || event.source !== publisherFrame.contentWindow) return;
      if (event.data?.type === 'zhe-publisher-close') closePublisher();
      if (event.data?.type === 'zhe-note-published') closePublisher(true);
    });

    let albumLoad = null;
    let albumLoaded = false;
    async function ensureAlbum() {
      if (albumLoaded) return;
      if (albumLoad) return albumLoad;
      albumLoad = (async () => {
        try {
          const response = await fetch('assets/archive-album.html?v=20261109-fast', {signal:AbortSignal.timeout(20000)});
          if (!response.ok) throw new Error('album');
          const markup = await response.text();
          albumView.innerHTML = markup;
          albumButtons = [...albumView.querySelectorAll('.album-open')];
          albumItems = [...albumView.querySelectorAll('.album-item')];
          bindAlbumButtons();
          for (const button of albumButtons) { pendingButtons.add(button); photoObserver?.observe(button); }
          const filter = document.querySelector('.filter-button.filter-active')?.dataset.filter || 'all';
          albumItems.forEach(item => { item.hidden = filter !== 'all' && !item.dataset.categories.split(' ').includes(filter); });
          albumView.querySelectorAll('.album-month').forEach(month => { month.hidden = ![...month.querySelectorAll('.album-item')].some(item => !item.hidden); });
          albumView.querySelectorAll('.album-year').forEach(year => { year.hidden = ![...year.querySelectorAll('.album-month')].some(month => !month.hidden); });
          albumLoaded = true;
          requestVisiblePhotoLoad();
        } catch {
          albumView.innerHTML = '<p class="album-loading" role="status">相册加载未完成，请再点一次 ALBUM 重试。</p>';
        } finally { albumLoad = null; }
      })();
      return albumLoad;
    }
