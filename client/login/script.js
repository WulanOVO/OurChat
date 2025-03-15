const form = document.getElementById("login-form");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const bodyData = Object.fromEntries(formData.entries());

  const res = await fetch("/api/login", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyData)
  });
  const data = await res.json();

  if (res.ok) {
    localStorage.clear();
    localStorage.setItem("token", data.token);
    localStorage.setItem("uid", data.data.uid);
    localStorage.setItem("username", data.data.username);
    localStorage.setItem("nickname", data.data.nickname);

    window.location.href = "/chat";
  } else {
    alert(data.message);
  }
});
