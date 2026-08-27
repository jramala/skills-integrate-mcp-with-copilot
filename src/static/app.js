document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Login/Logout elements
  const userBtn = document.getElementById("user-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeBtn = document.querySelector(".close-btn");
  const loginMessage = document.getElementById("login-message");
  
  let currentToken = localStorage.getItem("teacherToken") || null;
  let currentUsername = localStorage.getItem("teacherUsername") || null;

  // Check session on page load
  async function checkSession() {
    if (currentToken) {
      try {
        const response = await fetch(`/check-session?token=${currentToken}`);
        const result = await response.json();
        if (result.authenticated) {
          updateUserButton(result.username);
        } else {
          localStorage.removeItem("teacherToken");
          localStorage.removeItem("teacherUsername");
          currentToken = null;
          currentUsername = null;
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
    }
    fetchActivities();
  }

  // Update user button based on login status
  function updateUserButton(username) {
    currentUsername = username;
    userBtn.textContent = `👤 ${username} (Logout)`;
  }

  // Open login modal
  userBtn.addEventListener("click", () => {
    if (currentToken) {
      // Logout
      logout();
    } else {
      // Open login modal
      loginModal.classList.remove("hidden");
    }
  });

  // Close login modal
  closeBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginMessage.classList.add("hidden");
  });

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginMessage.classList.add("hidden");
    }
  });

  // Handle login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        // Save token and username
        currentToken = result.token;
        currentUsername = result.username;
        localStorage.setItem("teacherToken", currentToken);
        localStorage.setItem("teacherUsername", currentUsername);
        
        loginMessage.textContent = "Login successful!";
        loginMessage.className = "success";
        loginMessage.classList.remove("hidden");
        
        updateUserButton(result.username);
        
        setTimeout(() => {
          loginForm.reset();
          loginModal.classList.add("hidden");
          loginMessage.classList.add("hidden");
          fetchActivities(); // Refresh to show delete buttons
        }, 1000);
      } else {
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Login error. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Handle logout
  async function logout() {
    try {
      await fetch(`/logout?token=${currentToken}`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    
    // Clear stored token and username
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    currentToken = null;
    currentUsername = null;
    
    userBtn.textContent = "👤 Login";
    fetchActivities(); // Refresh to hide delete buttons
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons (only if logged in as teacher)
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) => {
                      const deleteBtn = currentToken
                        ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                        : "";
                      return `<li><span class="participant-email">${email}</span>${deleteBtn}</li>`;
                    }
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if logged in)
      if (currentToken) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality (teacher only)
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!currentToken) {
      messageDiv.textContent = "You must be logged in as a teacher to unregister students.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}&token=${encodeURIComponent(currentToken)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkSession();
});

