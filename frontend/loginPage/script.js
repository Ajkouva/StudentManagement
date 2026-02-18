
const EmailE1 = document.querySelector(".Email");
const PasswordE1 = document.querySelector(".Password");
const loginBtn = document.querySelector("#login-btn");
loginBtn.addEventListener("click", (e) => {
    loginwork();
})
async function loginwork() {
    const email = EmailE1.value;
    const password = PasswordE1.value;
    try {
        const rse = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            credentials: 'include',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        })
        const data = await rse.json();
        console.log(data);
    } catch (error) {
        console.log(error);
    }
}