document.addEventListener('DOMContentLoaded', () => {
   
    const studentBtn = document.getElementById('student-btn');
    const teacherBtn = document.getElementById('teacher-btn');
    const loginTitle = document.getElementById('login-title');
    const stduent_content=document.getElementById('stduent_content');
    const boxcontent2=document.querySelector(".In-box2");
   
    teacherBtn.classList.add('active');

    
    studentBtn.addEventListener('click', () => {
        setActiveUser('student');
    });

    teacherBtn.addEventListener('click', () => {
        setActiveUser('teacher');
    });

    function setActiveUser(type) {
        if (type === 'student') {
            studentBtn.classList.add('active');
            teacherBtn.classList.remove('active');
            loginTitle.textContent = 'Student Login';
            stduent_content.innerHTML='Welcome to <br>student portal';
            boxcontent2.style.backgroundImage='url("assets/image1.png")';
           
        } else {
            teacherBtn.classList.add('active');
            studentBtn.classList.remove('active');
            loginTitle.textContent = 'Teacher Login';
            stduent_content.innerHTML='Welcome to <br>teacher portal';
            boxcontent2.style.backgroundImage='url("assets/image.png")';
        }
    }
});
