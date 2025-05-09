const form = document.getElementById("register-form");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const bodyData = Object.fromEntries(formData.entries());

  if (bodyData.password !== bodyData.confirmPassword) {
    alert("两次密码输入不一致")
    return;
  }

  if (bodyData.username.length < 3 || bodyData.username.length > 30) {
    alert("用户名长度必须在3到30个字符之间")
    return;
  }

  if (bodyData.password.length < 6 || bodyData.password.length > 100) {
    alert("密码长度必须在6到100个字符之间")
    return;
  }

  const res = await fetch("/api/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyData),
  });
  const data = await res.json();

  if (res.ok) {
    window.location.href = "/login";
  } else {
    alert(data.message);
  }
});
