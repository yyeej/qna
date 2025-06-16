const API_BASE_URL = 'http://localhost:3000/api/admin';

// DOM 요소
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const loginMessage = document.getElementById('login-message');
const questionsManagementContainer = document.getElementById('questions-management-container');
const messageElem = document.getElementById('message');
const errorElem = document.getElementById('error-message');

// 페이지 로드 시 관리자 세션 확인
document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
});

// 관리자 세션 확인
function checkAdminSession() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        // 토큰이 있으면 관리자 패널 표시, 질문 로드
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        fetchAdminQuestions();
    } else {
        // 토큰이 없으면 로그인 섹션 표시
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
    }
}

// 관리자 로그인
async function adminLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:3000/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            loginMessage.textContent = data.message;
            loginMessage.style.color = 'green';
            checkAdminSession(); // 로그인 성공 후 패널 표시
        } else {
            loginMessage.textContent = data.message || '로그인 실패';
            loginMessage.style.color = 'red';
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        loginMessage.textContent = '서버 통신 오류';
        loginMessage.style.color = 'red';
    }
}

// 관리자 로그아웃
function adminLogout() {
    localStorage.removeItem('adminToken');
    loginMessage.textContent = '로그아웃 되었습니다.';
    loginMessage.style.color = 'blue';
    checkAdminSession(); // 로그아웃 후 로그인 섹션 표시
}

// 질문 및 답변 로드 (관리자용)
async function fetchAdminQuestions() {
    messageElem.textContent = '';
    errorElem.textContent = '';
    const token = localStorage.getItem('adminToken');
    if (!token) {
        errorElem.textContent = '인증 토큰이 없습니다. 다시 로그인해 주세요.';
        return;
    }

    try {
        // 일반 질문 조회 API를 사용하지만, 관리자용 UI를 위해 fetchAdminQuestions 함수 내부에서 호출
        const response = await fetch('http://localhost:3000/api/questions', {
            headers: {
                // 관리자 페이지지만, 모든 질문 조회는 인증이 필요없도록 백엔드에서 설정됨
                // 따라서 Authorization 헤더는 필수는 아니지만, 연습용으로 넣어둠.
                // 'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                errorElem.textContent = '인증 실패. 다시 로그인해 주세요.';
                localStorage.removeItem('adminToken');
                checkAdminSession();
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const questions = await response.json();
        renderAdminQuestions(questions);

    } catch (error) {
        console.error('관리자 질문 조회 오류:', error);
        errorElem.textContent = '질문을 불러오는 데 실패했습니다.';
    }
}

// 관리자 페이지에 질문 및 답변 렌더링
function renderAdminQuestions(questions) {
    questionsManagementContainer.innerHTML = '';
    questions.forEach(question => {
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('qa-item');
        questionDiv.innerHTML = `
            <div>
                <strong id="question-text-${question.id}">${question.question_text}</strong>
                <button class="edit" onclick="editQuestion(${question.id})">수정</button>
                <button class="delete" onclick="deleteQuestion(${question.id})">삭제</button>
            </div>
            <div class="answer-management">
                <h4>답변 관리:</h4>
                <div id="answers-for-question-${question.id}">
                    </div>
                <div class="add-answer-form">
                    <textarea id="new-answer-text-${question.id}" rows="2" placeholder="새 답변 내용" required></textarea>
                    <input type="file" id="new-answer-image-${question.id}" accept="image/*">
                    <button onclick="addAnswer(${question.id})">답변 추가</button>
                </div>
            </div>
        `;
        questionsManagementContainer.appendChild(questionDiv);

        const answersContainer = document.getElementById(`answers-for-question-${question.id}`);
        if (question.answers && question.answers.length > 0) {
            question.answers.forEach(answer => {
                const answerItemDiv = document.createElement('div');
                answerItemDiv.classList.add('answer-management-item');
                let answerContent = `<span id="answer-text-${answer.id}">${answer.answer_text}</span>`;
                if (answer.image_url) {
                    answerContent += `<img id="answer-image-${answer.id}" src="http://localhost:3000${answer.image_url}" alt="답변 이미지">`;
                }
                answerItemDiv.innerHTML = `
                    ${answerContent}
                    <button class="edit" onclick="editAnswer(${answer.id})">수정</button>
                    <button class="delete" onclick="deleteAnswer(${answer.id})">삭제</button>
                `;
                answersContainer.appendChild(answerItemDiv);
            });
        } else {
            answersContainer.innerHTML = '<p>아직 등록된 답변이 없습니다.</p>';
        }
    });
}

// 질문 추가
async function addQuestion() {
    const questionText = document.getElementById('new-question-text').value;
    if (!questionText.trim()) {
        alert('질문 내용을 입력해주세요.');
        return;
    }
    const token = localStorage.getItem('adminToken');

    try {
        const response = await fetch(`${API_BASE_URL}/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question_text: questionText })
        });

        if (response.ok) {
            messageElem.textContent = '질문이 성공적으로 추가되었습니다.';
            document.getElementById('new-question-text').value = '';
            fetchAdminQuestions(); // 목록 새로고침
        } else {
            const errorData = await response.text();
            throw new Error(errorData || '질문 추가 실패');
        }
    } catch (error) {
        console.error('질문 추가 오류:', error);
        errorElem.textContent = `질문 추가 중 오류 발생: ${error.message}`;
    }
}

// 질문 수정 (입력 필드로 변경)
function editQuestion(questionId) {
    const questionTextElem = document.getElementById(`question-text-${questionId}`);
    const currentText = questionTextElem.textContent;

    const inputField = document.createElement('textarea');
    inputField.value = currentText;
    inputField.rows = 2;
    inputField.style.width = '70%';
    inputField.style.verticalAlign = 'middle';

    const saveButton = document.createElement('button');
    saveButton.classList.add('save');
    saveButton.textContent = '저장';
    saveButton.onclick = () => saveQuestion(questionId, inputField.value);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = '취소';
    cancelButton.onclick = () => {
        questionTextElem.textContent = currentText;
        // 기존 버튼 다시 보이게 처리
        const parentDiv = inputField.parentNode;
        parentDiv.insertBefore(questionTextElem, inputField);
        inputField.remove();
        saveButton.remove();
        cancelButton.remove();
        parentDiv.querySelector('.edit').style.display = 'inline-block';
        parentDiv.querySelector('.delete').style.display = 'inline-block';
    };

    const parentDiv = questionTextElem.parentNode;
    parentDiv.replaceChild(inputField, questionTextElem);
    parentDiv.insertBefore(saveButton, inputField.nextSibling);
    parentDiv.insertBefore(cancelButton, saveButton.nextSibling);

    // 기존 수정/삭제 버튼 숨기기
    parentDiv.querySelector('.edit').style.display = 'none';
    parentDiv.querySelector('.delete').style.display = 'none';
}

// 질문 저장
async function saveQuestion(questionId, newText) {
    if (!newText.trim()) {
        alert('질문 내용을 입력해주세요.');
        return;
    }
    const token = localStorage.getItem('adminToken');

    try {
        const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question_text: newText })
        });

        if (response.ok) {
            messageElem.textContent = '질문이 성공적으로 수정되었습니다.';
            fetchAdminQuestions();
        } else {
            const errorData = await response.text();
            throw new Error(errorData || '질문 수정 실패');
        }
    } catch (error) {
        console.error('질문 수정 오류:', error);
        errorElem.textContent = `질문 수정 중 오류 발생: ${error.message}`;
    }
}

// 질문 삭제
async function deleteQuestion(questionId) {
    if (!confirm('정말로 이 질문을 삭제하시겠습니까? 관련 답변도 모두 삭제됩니다.')) {
        return;
    }
    const token = localStorage.getItem('adminToken');

    try {
        const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            messageElem.textContent = '질문이 성공적으로 삭제되었습니다.';
            fetchAdminQuestions();
        } else {
            const errorData = await response.text();
            throw new Error(errorData || '질문 삭제 실패');
        }
    } catch (error) {
        console.error('질문 삭제 오류:', error);
        errorElem.textContent = `질문 삭제 중 오류 발생: ${error.message}`;
    }
}

// 답변 추가
async function addAnswer(questionId) {
    const answerText = document.getElementById(`new-answer-text-${questionId}`).value;
    const answerImageFile = document.getElementById(`new-answer-image-${questionId}`).files[0];

    if (!answerText.trim() && !answerImageFile) {
        alert('답변 내용 또는 이미지를 입력/첨부해주세요.');
        return;
    }

    const token = localStorage.getItem('adminToken');
    const formData = new FormData();
    formData.append('question_id', questionId);
    formData.append('answer_text', answerText);
    if (answerImageFile) {
        formData.append('answer_image', answerImageFile);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/answers`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            messageElem.textContent = '답변이 성공적으로 추가되었습니다.';
            document.getElementById(`new-answer-text-${questionId}`).value = '';
            document.getElementById(`new-answer-image-${questionId}`).value = ''; // 파일 입력 초기화
            fetchAdminQuestions();
        } else {
            const errorData = await response.text();
            throw new Error(errorData || '답변 추가 실패');
        }
    } catch (error) {
        console.error('답변 추가 오류:', error);
        errorElem.textContent = `답변 추가 중 오류 발생: ${error.message}`;
    }
}

// 답변 수정 (입력 필드로 변경)
function editAnswer(answerId) {
    const answerItemDiv = document.getElementById(`answer-text-${answerId}`).closest('.answer-management-item');
    const answerTextElem = answerItemDiv.querySelector(`#answer-text-${answerId}`);
    const answerImageElem = answerItemDiv.querySelector(`#answer-image-${answerId}`);

    const currentText = answerTextElem.textContent;
    const currentImageSrc = answerImageElem ? answerImageElem.src : '';

    const inputField = document.createElement('textarea');
    inputField.value = currentText;
    inputField.rows = 2;
    inputField.style.width = '70%';
    inputField.style.verticalAlign = 'middle';
    inputField.style.display = 'block'; // 새 줄로 표시

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'block';
    imageInput.style.marginTop = '5px';

    const deleteImageCheckbox = document.createElement('input');
    deleteImageCheckbox.type = 'checkbox';
    deleteImageCheckbox.id = `delete-image-${answerId}`;
    deleteImageCheckbox.classList.add('delete-image-checkbox');
    const deleteImageLabel = document.createElement('label');
    deleteImageLabel.setAttribute('for', `delete-image-${answerId}`);
    deleteImageLabel.textContent = '이미지 삭제';

    const saveButton = document.createElement('button');
    saveButton.classList.add('save');
    saveButton.textContent = '저장';
    saveButton.onclick = () => saveAnswer(
        answerId,
        inputField.value,
        imageInput.files[0] || null, // 새로 선택된 파일
        currentImageSrc,            // 기존 이미지 URL
        deleteImageCheckbox.checked // 이미지 삭제 체크박스 상태
    );

    const cancelButton = document.createElement('button');
    cancelButton.textContent = '취소';
    cancelButton.onclick = () => {
        // 원래 상태로 되돌리기
        answerTextElem.textContent = currentText;
        if (answerImageElem) {
            answerItemDiv.replaceChild(answerImageElem, imageInput);
            answerImageElem.style.display = 'block';
        } else {
            imageInput.remove();
        }
        deleteImageCheckbox.remove();
        deleteImageLabel.remove();

        answerItemDiv.replaceChild(answerTextElem, inputField);
        saveButton.remove();
        cancelButton.remove();

        // 기존 버튼 다시 보이게
        answerItemDiv.querySelector('.edit').style.display = 'inline-block';
        answerItemDiv.querySelector('.delete').style.display = 'inline-block';
    };

    // DOM 교체 및 버튼 추가
    answerItemDiv.replaceChild(inputField, answerTextElem);
    if (answerImageElem) {
        answerItemDiv.replaceChild(imageInput, answerImageElem);
    } else {
        answerItemDiv.insertBefore(imageInput, inputField.nextSibling);
    }

    answerItemDiv.insertBefore(deleteImageLabel, imageInput.nextSibling);
    answerItemDiv.insertBefore(deleteImageCheckbox, deleteImageLabel);
    answerItemDiv.insertBefore(saveButton, deleteImageCheckbox.nextSibling);
    answerItemDiv.insertBefore(cancelButton, saveButton.nextSibling);

    // 기존 수정/삭제 버튼 숨기기
    answerItemDiv.querySelector('.edit').style.display = 'none';
    answerItemDiv.querySelector('.delete').style.display = 'none';
}


// 답변 저장
async function saveAnswer(answerId, newText, newImageFile, currentImageSrc, deleteImage) {
    if (!newText.trim() && !newImageFile && !currentImageSrc && !deleteImage) {
        alert('답변 내용, 새 이미지, 또는 기존 이미지 유지/삭제 중 하나를 선택해야 합니다.');
        return;
    }
    const token = localStorage.getItem('adminToken');

    const formData = new FormData();
    formData.append('answer_text', newText);
    formData.append('current_image_url', currentImageSrc.replace('http://localhost:3000', '')); // 이미지 경로만 보냄

    if (newImageFile) {
        formData.append('answer_image', newImageFile);
        formData.append('delete_image', 'false'); // 새 파일 업로드 시 삭제 체크박스는 무시
    } else if (deleteImage) { // 새 파일 없고, 삭제 체크된 경우
        formData.append('delete_image', 'true');
    } else { // 새 파일 없고, 삭제 체크 안 된 경우 (기존 이미지 유지)
        formData.append('delete_image', 'false');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/answers/${answerId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            messageElem.textContent = '답변이 성공적으로 수정되었습니다.';
            fetchAdminQuestions();
        } else {
            const errorData = await response.text();
            throw new Error(errorData || '답변 수정 실패');
        }
    } catch (error) {
        console.error('답변 수정 오류:', error);
        errorElem.textContent = `답변 수정 중 오류 발생: ${error.message}`;
    }
}


// 답변 삭제
async function deleteAnswer(answerId) {
    if (!confirm('정말로 이 답변을 삭제하시겠습니까?')) {
        return;
    }
    const token = localStorage.getItem('adminToken');

    try {
        const response = await fetch(`${API_BASE_URL}/answers/${answerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            messageElem.textContent = '답변이 성공적으로 삭제되었습니다.';
            fetchAdminQuestions();
        } else {
            const errorData = await response.text();
            throw new Error(errorData || '답변 삭제 실패');
        }
    } catch (error) {
        console.error('답변 삭제 오류:', error);
        errorElem.textContent = `답변 삭제 중 오류 발생: ${error.message}`;
    }
}