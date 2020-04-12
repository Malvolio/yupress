const setUserStatus = () => {
    const userId = Cookies.get('USERID');
    if (userId) {
        $('.loggedin').show();
        $('.loggedout').hide();
    } else {
        $('.loggedin').hide();
        $('.loggedout').show();
    }
};
 
const displayResult = async (resp) => {
  try {
    await resp;
    $("#displayStatus").text(String(resp.status));
    $("#displayBody").text(resp.responseText);
  } catch (e) {
    $("#displayStatus").text(String(resp.status));
    $("#displayBody").text(resp.statusText);  
  }
  setUserStatus();
};

const logIn = ({username, password}) => {
    displayResult($.ajax({
            type: "POST",
            url: '/api/login',
             data: JSON.stringify({
                username: username.value, 
                password: password.value
            }),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
        }));
};

const logOut = () => {
    displayResult($.post('/api/logout'));
};

const checkId = ({user}) => {
    displayResult($.ajax({
            type: "GET",
            url: `/api/isme/${user.value}`,
        }));
};

$(() => {
    setUserStatus();
});
