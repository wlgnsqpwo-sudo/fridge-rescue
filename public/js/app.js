/**
 * ==========================================================================
 * 냉장고 구조대 (FRIDGE RESCUE) — 메인 클라이언트 애플리케이션 스크립트
 * ==========================================================================
 * 주요 구현 기능:
 * 1. 탭 전환 (사진 분석 vs 직접 입력)
 * 2. 다중 사진 업로드(최대 5장), 1장당 8MB 크기 제한 및 MIME 검증, 미리보기/개별삭제
 * 3. AI 사진 식재료 분석 요청 (/api/analyze)
 * 4. 식재료 확인/선택/수정/삭제/추가 관리 UI (체크박스, 인라인 추가 등)
 * 5. 요리 추천 요청 (/api/recipes) 및 3개 추천 카드 렌더링
 * 6. 선택 요리 상세 레시피 및 분량/단계/안전 수칙 표시
 * 7. 로그인 없는 피드백 작성 (/api/feedback POST) 및 최신순 목록 조회 (/api/feedback GET)
 * 8. 사용자 친화적 한국어 안내 및 토스트 알림
 */

document.addEventListener('DOMContentLoaded', () => {
  // ========================================================================
  // [1] 전역 상태 관리 (State Management)
  // ========================================================================
  const state = {
    selectedPhotos: [], // 업로드 대기 중인 File 객체 배열 (최대 5개)
    // 등록된 식재료 리스트: { id: string, name: string, checked: boolean, confidence: string, note: string }
    ingredients: [],
    recommendedRecipes: [], // AI가 추천한 레시피 3개 목록
    selectedRecipeIndex: null // 현재 열려있는 상세 레시피 인덱스
  };

  // ========================================================================
  // [2] DOM 엘리먼트 캐싱
  // ========================================================================
  // 탭 관련
  const tabPhotoBtn = document.getElementById('tab-photo-btn');
  const tabDirectBtn = document.getElementById('tab-direct-btn');
  const tabPhotoPanel = document.getElementById('tab-photo');
  const tabDirectPanel = document.getElementById('tab-direct');

  // 사진 업로드 관련
  const uploadDropzone = document.getElementById('upload-dropzone');
  const photoInput = document.getElementById('photo-input');
  const photoPreviewContainer = document.getElementById('photo-preview-container');
  const previewCount = document.getElementById('preview-count');
  const previewGrid = document.getElementById('preview-grid');
  const btnClearPhotos = document.getElementById('btn-clear-photos');
  const btnAnalyzePhotos = document.getElementById('btn-analyze-photos');
  const analyzeSpinner = document.getElementById('analyze-spinner');

  // 직접 입력 관련
  const directIngredientInput = document.getElementById('direct-ingredient-input');
  const btnAddDirect = document.getElementById('btn-add-direct');

  // 식재료 검토/확인 영역
  const ingredientsChips = document.getElementById('ingredients-chips');
  const emptyIngredientsText = document.getElementById('empty-ingredients-text');
  const ingredientsCountSummary = document.getElementById('ingredients-count-summary');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  const btnClearAllIngredients = document.getElementById('btn-clear-all-ingredients');
  const addMoreInput = document.getElementById('add-more-input');
  const btnAddMore = document.getElementById('btn-add-more');

  // 요리 추천 조건 및 버튼
  const servingsSelect = document.getElementById('servings-select');
  const preferenceInput = document.getElementById('preference-input');
  const useFirstInput = document.getElementById('use-first-input');
  const btnRequestRecipes = document.getElementById('btn-request-recipes');
  const recipeSpinner = document.getElementById('recipe-spinner');

  // 요리 추천 결과 영역
  const recipeResultsSection = document.getElementById('recipe-results-section');
  const recipeCardsGrid = document.getElementById('recipe-cards-grid');
  const recipeDetailBox = document.getElementById('recipe-detail-box');

  // 피드백 영역
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackName = document.getElementById('feedback-name');
  const feedbackMessage = document.getElementById('feedback-message');
  const charCounter = document.getElementById('char-counter');
  const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
  const feedbackSpinner = document.getElementById('feedback-spinner');
  const feedbackList = document.getElementById('feedback-list');
  const btnRefreshFeedback = document.getElementById('btn-refresh-feedback');

  // 토스트 컨테이너
  const toastContainer = document.getElementById('toast-container');

  // ========================================================================
  // [3] 유틸리티 함수 (토스트, 이스케이프 등)
  // ========================================================================
  /**
   * 사용자 화면에 토스트 알림을 띄웁니다.
   * @param {string} message 알림 문구
   * @param {'success'|'error'|'warning'|'info'} type 토스트 타입
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /**
   * XSS 공격을 방지하기 위해 HTML 특수문자를 이스케이프 처리합니다.
   */
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ========================================================================
  // [4] 탭 전환 이벤트 핸들러
  // ========================================================================
  tabPhotoBtn.addEventListener('click', () => {
    tabPhotoBtn.classList.add('active');
    tabPhotoBtn.setAttribute('aria-selected', 'true');
    tabDirectBtn.classList.remove('active');
    tabDirectBtn.setAttribute('aria-selected', 'false');

    tabPhotoPanel.classList.add('active');
    tabPhotoPanel.removeAttribute('hidden');
    tabDirectPanel.classList.remove('active');
    tabDirectPanel.setAttribute('hidden', '');
  });

  tabDirectBtn.addEventListener('click', () => {
    tabDirectBtn.classList.add('active');
    tabDirectBtn.setAttribute('aria-selected', 'true');
    tabPhotoBtn.classList.remove('active');
    tabPhotoBtn.setAttribute('aria-selected', 'false');

    tabDirectPanel.classList.add('active');
    tabDirectPanel.removeAttribute('hidden');
    tabPhotoPanel.classList.remove('active');
    tabPhotoPanel.setAttribute('hidden', '');
    directIngredientInput.focus();
  });

  // ========================================================================
  // [5] 사진 업로드 & 드래그 앤 드롭 & 미리보기 기능
  // ========================================================================
  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  uploadDropzone.addEventListener('click', () => photoInput.click());

  uploadDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      photoInput.click();
    }
  });

  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
  });

  uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
  });

  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  });

  photoInput.addEventListener('change', () => {
    if (photoInput.files && photoInput.files.length > 0) {
      handleFilesSelected(Array.from(photoInput.files));
      photoInput.value = ''; // 재선택 가능하도록 초기화
    }
  });

  /**
   * 새로 선택된 사진 파일들의 유효성을 검증하고 상태에 추가합니다.
   */
  function handleFilesSelected(newFiles) {
    let rejectedCount = 0;
    let sizeRejectedCount = 0;

    for (const file of newFiles) {
      if (state.selectedPhotos.length >= MAX_PHOTOS) {
        showToast(`사진은 최대 ${MAX_PHOTOS}장까지만 업로드할 수 있습니다.`, 'warning');
        break;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        rejectedCount++;
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        sizeRejectedCount++;
        continue;
      }

      state.selectedPhotos.push(file);
    }

    if (rejectedCount > 0) {
      showToast('JPG, PNG, WEBP 파일만 업로드할 수 있습니다.', 'error');
    }
    if (sizeRejectedCount > 0) {
      showToast('8MB를 초과하는 사진은 제외되었습니다.', 'warning');
    }

    renderPhotoPreviews();
  }

  /**
   * 선택된 사진 미리보기 썸네일 렌더링
   */
  function renderPhotoPreviews() {
    previewGrid.innerHTML = '';
    const count = state.selectedPhotos.length;

    if (count === 0) {
      photoPreviewContainer.classList.add('hidden');
      btnAnalyzePhotos.disabled = true;
      return;
    }

    photoPreviewContainer.classList.remove('hidden');
    previewCount.textContent = `선택된 사진: ${count}장 / 최대 ${MAX_PHOTOS}장`;
    btnAnalyzePhotos.disabled = false;

    state.selectedPhotos.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      const img = document.createElement('img');
      img.alt = `업로드 사진 ${index + 1}`;
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      // 메모리 누수 방지
      img.onload = () => URL.revokeObjectURL(objectUrl);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'preview-item-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = '이 사진 삭제';
      removeBtn.setAttribute('aria-label', `사진 ${index + 1} 삭제`);
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePhoto(index);
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      previewGrid.appendChild(item);
    });
  }

  /**
   * 특정 사진 개별 삭제
   */
  function removePhoto(index) {
    state.selectedPhotos.splice(index, 1);
    renderPhotoPreviews();
    showToast('사진이 삭제되었습니다.', 'info');
  }

  /**
   * 사진 전체 비우기
   */
  btnClearPhotos.addEventListener('click', () => {
    state.selectedPhotos = [];
    renderPhotoPreviews();
    showToast('모든 사진이 초기화되었습니다.', 'info');
  });

  // ========================================================================
  // [6] AI 식재료 사진 분석 요청 (/api/analyze)
  // ========================================================================
  btnAnalyzePhotos.addEventListener('click', async () => {
    if (state.selectedPhotos.length === 0) {
      showToast('분석할 사진을 선택해 주세요.', 'warning');
      return;
    }

    // 로딩 상태 시작
    btnAnalyzePhotos.disabled = true;
    analyzeSpinner.classList.remove('hidden');

    try {
      const formData = new FormData();
      state.selectedPhotos.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '사진 분석 중 오류가 발생했습니다.');
      }

      const analyzedIngredients = result.ingredients || [];
      if (analyzedIngredients.length === 0) {
        showToast('사진에서 식별 가능한 식재료를 찾지 못했습니다. 직접 입력해 보세요!', 'warning');
      } else {
        // 분석된 재료들을 상태에 추가 (기존 목록과 중복 검사)
        let addedCount = 0;
        analyzedIngredients.forEach((item) => {
          const name = item.name.trim();
          if (name && !state.ingredients.some((exist) => exist.name === name)) {
            state.ingredients.push({
              id: 'ing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              name: name,
              checked: true,
              confidence: item.confidence || 'high',
              note: item.note || ''
            });
            addedCount++;
          }
        });

        renderIngredients();
        showToast(`AI가 ${addedCount}개의 식재료 후보를 찾았습니다. 확인해 보세요!`, 'success');

        // 2단계 영역으로 부드럽게 스크롤 이동
        document.getElementById('ingredients-review-section').scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error('분석 에러:', error);
      showToast(error.message || '사진 분석에 실패했습니다. 직접 입력 기능을 이용해 주세요.', 'error');
    } finally {
      btnAnalyzePhotos.disabled = false;
      analyzeSpinner.classList.add('hidden');
    }
  });

  // ========================================================================
  // [7] 직접 텍스트 입력 및 재료 관리 기능
  // ========================================================================
  /**
   * 직접 입력창에서 재료를 파싱하여 추가합니다.
   */
  function addDirectIngredients() {
    const rawVal = directIngredientInput.value.trim();
    if (!rawVal) {
      showToast('추가할 식재료 이름을 입력해 주세요.', 'warning');
      return;
    }

    // 쉼표(,) 및 줄바꿈으로 분리
    const items = rawVal.split(/[,|\n]+/).map((s) => s.trim()).filter(Boolean);
    let addedCount = 0;

    items.forEach((name) => {
      if (!state.ingredients.some((exist) => exist.name === name)) {
        state.ingredients.push({
          id: 'ing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: name,
          checked: true,
          confidence: 'high',
          note: '직접 입력됨'
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      directIngredientInput.value = '';
      renderIngredients();
      showToast(`${addedCount}개의 재료가 추가되었습니다.`, 'success');
    } else {
      showToast('이미 등록되어 있는 재료입니다.', 'warning');
    }
  }

  btnAddDirect.addEventListener('click', addDirectIngredients);
  directIngredientInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDirectIngredients();
    }
  });

  // 인라인 추가 (+ 재료 추가) 버튼
  btnAddMore.addEventListener('click', () => {
    const name = addMoreInput.value.trim();
    if (!name) return;
    if (state.ingredients.some((exist) => exist.name === name)) {
      showToast('이미 목록에 있는 재료입니다.', 'warning');
      return;
    }

    state.ingredients.push({
      id: 'ing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      checked: true,
      confidence: 'high',
      note: '추가 입력'
    });
    addMoreInput.value = '';
    renderIngredients();
    showToast(`'${name}' 재료가 추가되었습니다.`, 'success');
  });

  addMoreInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddMore.click();
    }
  });

  // 전체 선택 / 해제 / 삭제
  btnSelectAll.addEventListener('click', () => {
    state.ingredients.forEach((item) => (item.checked = true));
    renderIngredients();
  });

  btnDeselectAll.addEventListener('click', () => {
    state.ingredients.forEach((item) => (item.checked = false));
    renderIngredients();
  });

  btnClearAllIngredients.addEventListener('click', () => {
    if (state.ingredients.length === 0) return;
    if (confirm('등록된 모든 식재료를 삭제하시겠습니까?')) {
      state.ingredients = [];
      renderIngredients();
      showToast('재료 목록이 모두 비워졌습니다.', 'info');
    }
  });

  /**
   * 재료 칩 렌더링 및 동기화
   */
  function renderIngredients() {
    ingredientsChips.innerHTML = '';

    if (state.ingredients.length === 0) {
      emptyIngredientsText.classList.remove('hidden');
      ingredientsChips.appendChild(emptyIngredientsText);
      ingredientsCountSummary.textContent = '선택된 재료: 0개';
      btnRequestRecipes.disabled = true;
      return;
    }

    emptyIngredientsText.classList.add('hidden');

    const checkedItems = state.ingredients.filter((i) => i.checked);
    ingredientsCountSummary.textContent = `선택된 재료: ${checkedItems.length}개 / 전체 ${state.ingredients.length}개`;
    btnRequestRecipes.disabled = checkedItems.length === 0;

    state.ingredients.forEach((item) => {
      const chip = document.createElement('div');
      const isUncertain = item.confidence === 'low' || item.confidence === 'medium';
      chip.className = `ingredient-chip ${item.checked ? 'checked' : ''} ${isUncertain ? 'need-confirm' : ''}`;

      // 체크박스
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.checked;
      checkbox.setAttribute('aria-label', `${item.name} 선택`);
      checkbox.addEventListener('change', () => {
        item.checked = checkbox.checked;
        renderIngredients();
      });

      // 재료명 (클릭 시 이름 수정 가능)
      const nameSpan = document.createElement('span');
      nameSpan.className = 'chip-name';
      nameSpan.textContent = item.name;
      nameSpan.title = '클릭하여 이름 수정';
      nameSpan.addEventListener('click', () => {
        const newName = prompt('재료 이름을 수정해 주세요:', item.name);
        if (newName && newName.trim() && newName.trim() !== item.name) {
          item.name = newName.trim();
          renderIngredients();
        }
      });

      chip.appendChild(checkbox);
      chip.appendChild(nameSpan);

      // 불확실 항목 안내 배지
      if (isUncertain) {
        const badge = document.createElement('span');
        badge.className = 'chip-badge';
        badge.textContent = '확인 필요';
        if (item.note) badge.title = item.note;
        chip.appendChild(badge);
      }

      // 삭제 버튼
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-btn-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.setAttribute('aria-label', `${item.name} 삭제`);
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.ingredients = state.ingredients.filter((i) => i.id !== item.id);
        renderIngredients();
      });

      chip.appendChild(removeBtn);
      ingredientsChips.appendChild(chip);
    });
  }

  // ========================================================================
  // [8] AI 요리 추천 요청 및 레시피 카드 렌더링 (/api/recipes)
  // ========================================================================
  btnRequestRecipes.addEventListener('click', async () => {
    const selectedIngredients = state.ingredients.filter((i) => i.checked).map((i) => i.name);

    if (selectedIngredients.length === 0) {
      showToast('요리에 활용할 재료를 1개 이상 선택해 주세요.', 'warning');
      return;
    }

    const servings = parseInt(servingsSelect.value, 10) || 2;
    const preference = preferenceInput.value.trim();
    const useFirstRaw = useFirstInput.value.trim();
    const useFirst = useFirstRaw ? useFirstRaw.split(/[,|\n]+/).map((s) => s.trim()).filter(Boolean) : [];

    // 로딩 상태 시작
    btnRequestRecipes.disabled = true;
    recipeSpinner.classList.remove('hidden');

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: selectedIngredients,
          servings: servings,
          preference: preference,
          useFirst: useFirst
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '요리 추천을 가져오지 못했습니다.');
      }

      state.recommendedRecipes = result.recipes || [];
      state.selectedRecipeIndex = null;

      if (state.recommendedRecipes.length === 0) {
        showToast('추천할 만한 요리를 찾지 못했습니다. 재료를 더 추가해 보세요.', 'warning');
      } else {
        renderRecipeCards();
        recipeResultsSection.classList.remove('hidden');
        recipeResultsSection.scrollIntoView({ behavior: 'smooth' });
        showToast('맛있는 맞춤 요리 3가지가 도착했습니다!', 'success');
      }
    } catch (error) {
      console.error('요리 추천 에러:', error);
      showToast(error.message || '요리 추천 중 오류가 발생했습니다.', 'error');
    } finally {
      btnRequestRecipes.disabled = false;
      recipeSpinner.classList.add('hidden');
    }
  });

  /**
   * 요리 추천 카드 3개 렌더링
   */
  function renderRecipeCards() {
    recipeCardsGrid.innerHTML = '';
    recipeDetailBox.classList.add('hidden');

    state.recommendedRecipes.forEach((recipe, index) => {
      const card = document.createElement('div');
      card.className = `recipe-card ${state.selectedRecipeIndex === index ? 'selected' : ''}`;

      const ownedList = (recipe.ownedIngredients || []).join(', ') || '없음';
      const extraList = (recipe.extraIngredients || []).join(', ') || '추가 재료 없음';

      card.innerHTML = `
        <div class="recipe-card-header">
          <h3 class="recipe-name">${escapeHtml(recipe.name)}</h3>
          <div class="recipe-badges">
            <span class="badge-time">⏱️ ${recipe.timeMinutes || 20}분</span>
            <span class="badge-diff">난이도: ${escapeHtml(recipe.difficulty || '보통')}</span>
          </div>
        </div>
        <p class="recipe-reason">${escapeHtml(recipe.reason || '보유하신 재료로 손쉽게 만들 수 있습니다.')}</p>
        <div class="recipe-ingredients-summary">
          <div><span class="owned-tag">✓ 보유 재료:</span> ${escapeHtml(ownedList)}</div>
          <div><span class="extra-tag">+ 추가 재료:</span> ${escapeHtml(extraList)}</div>
        </div>
        <button type="button" class="btn btn-outline-success btn-view-recipe">
          📖 레시피 & 조리법 보기
        </button>
      `;

      card.addEventListener('click', () => {
        state.selectedRecipeIndex = index;
        renderRecipeCards();
        renderRecipeDetail(recipe);
      });

      recipeCardsGrid.appendChild(card);
    });

    // 기본적으로 첫 번째 레시피를 상세 펼침
    if (state.recommendedRecipes.length > 0 && state.selectedRecipeIndex === null) {
      state.selectedRecipeIndex = 0;
      renderRecipeDetail(state.recommendedRecipes[0]);
    }
  }

  /**
   * 상세 레시피 렌더링
   */
  function renderRecipeDetail(recipe) {
    if (!recipe) return;

    recipeDetailBox.classList.remove('hidden');

    const servings = servingsSelect.value || '2';
    const amountItems = Array.isArray(recipe.ingredientAmounts)
      ? recipe.ingredientAmounts.map((i) => `<li><span>${escapeHtml(i.name)}</span> <strong>${escapeHtml(i.amount)}</strong></li>`).join('')
      : '<li>재료 분량 정보가 준비 중입니다.</li>';

    const stepItems = Array.isArray(recipe.steps)
      ? recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')
      : '<li>조리 순서가 없습니다.</li>';

    recipeDetailBox.innerHTML = `
      <div class="detail-header">
        <div>
          <h3 class="detail-title">🍳 ${escapeHtml(recipe.name)}</h3>
          <div class="detail-sub-meta">
            <span>기준: ${servings}인분</span>
            <span>예상 시간: 약 ${recipe.timeMinutes || 20}분</span>
            <span>난이도: ${escapeHtml(recipe.difficulty || '보통')}</span>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline" id="btn-close-detail">닫기 &times;</button>
      </div>

      <h4 class="detail-section-title">🥣 필요한 재료 및 분량 (${servings}인분 기준)</h4>
      <ul class="amount-list">
        ${amountItems}
      </ul>

      <h4 class="detail-section-title">👨‍🍳 단계별 조리 순서</h4>
      <ol class="steps-list">
        ${stepItems}
      </ol>

      <div class="detail-safety-notice">
        <strong>⚠️ 안심 조리 안내:</strong> ${escapeHtml(recipe.safetyTip || '식재료의 신선도와 냄새를 직접 확인하고, 상함이 의심되는 재료는 절대 섭취하지 마세요. 조리 시간과 분량은 참고용 추정치입니다.')}
      </div>
    `;

    document.getElementById('btn-close-detail').addEventListener('click', () => {
      recipeDetailBox.classList.add('hidden');
      state.selectedRecipeIndex = null;
      renderRecipeCards();
    });

    recipeDetailBox.scrollIntoView({ behavior: 'smooth' });
  }

  // ========================================================================
  // [9] 로그인 없는 피드백 기능 (등록 & 최신순 조회)
  // ========================================================================
  // 글자 수 실시간 카운트
  feedbackMessage.addEventListener('input', () => {
    const len = feedbackMessage.value.length;
    charCounter.textContent = `${len} / 500자`;
    if (len > 500) {
      charCounter.style.color = 'var(--color-danger)';
    } else {
      charCounter.style.color = 'var(--color-text-muted)';
    }
  });

  // 피드백 제출
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = feedbackName.value.trim();
    const message = feedbackMessage.value.trim();

    if (!message || message.length < 1 || message.length > 500) {
      showToast('피드백 내용은 1자 이상 500자 이하로 작성해 주세요.', 'warning');
      feedbackMessage.focus();
      return;
    }

    btnSubmitFeedback.disabled = true;
    feedbackSpinner.classList.remove('hidden');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '피드백 저장에 실패했습니다.');
      }

      showToast(result.message || '피드백이 성공적으로 등록되었습니다!', 'success');
      feedbackForm.reset();
      charCounter.textContent = '0 / 500자';
      // 피드백 목록 새로고침
      loadFeedbackList();
    } catch (error) {
      console.error('피드백 저장 오류:', error);
      showToast(error.message || '피드백 등록 중 오류가 발생했습니다.', 'error');
    } finally {
      btnSubmitFeedback.disabled = false;
      feedbackSpinner.classList.add('hidden');
    }
  });

  btnRefreshFeedback.addEventListener('click', loadFeedbackList);

  /**
   * 피드백 최신순 목록 불러오기 (/api/feedback GET)
   */
  async function loadFeedbackList() {
    feedbackList.innerHTML = `
      <div class="loading-state">
        <span class="spinner" aria-hidden="true"></span>
        <span>피드백 목록을 새로 불러오는 중입니다...</span>
      </div>
    `;

    try {
      const response = await fetch('/api/feedback');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '피드백 목록을 불러오지 못했습니다.');
      }

      const feedbacks = result.feedbacks || [];
      renderFeedbackList(feedbacks);
    } catch (error) {
      console.error('피드백 조회 에러:', error);
      feedbackList.innerHTML = `
        <div class="empty-state-text" style="color: var(--color-danger);">
          피드백 목록을 불러오는 도중 오류가 발생했습니다. (잠시 후 다시 시도해 주세요)
        </div>
      `;
    }
  }

  /**
   * 피드백 리스트 렌더링
   */
  function renderFeedbackList(feedbacks) {
    feedbackList.innerHTML = '';

    if (!feedbacks || feedbacks.length === 0) {
      feedbackList.innerHTML = `
        <div class="empty-state-text">
          아직 등록된 피드백이 없습니다. 첫 번째 구조대원이 되어 소중한 의견을 남겨주세요!
        </div>
      `;
      return;
    }

    feedbacks.forEach((fb) => {
      const item = document.createElement('div');
      item.className = 'feedback-item';

      const dateStr = fb.created_at ? new Date(fb.created_at).toLocaleString('ko-KR') : '방금 전';

      item.innerHTML = `
        <div class="feedback-item-header">
          <span class="feedback-author">${escapeHtml(fb.name || '익명의 구조대원')}</span>
          <span class="feedback-time">${escapeHtml(dateStr)}</span>
        </div>
        <p class="feedback-msg">${escapeHtml(fb.message)}</p>
      `;

      feedbackList.appendChild(item);
    });
  }

  // ========================================================================
  // [10] 초기 실행 (초기화)
  // ========================================================================
  renderIngredients();
  loadFeedbackList();
});

