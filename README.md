Reverse Coding Backend

/signup -> For signup of new user
/login -> Login into account
/getavail -> To find the people without a team
/sendinvite -> To send an invite to a person to join your team. Will show error if you have no teams created
/addteam -> To add a new team. Unique team name
/deleteteam -> To delete your team, in case no one joins. If your team has been filled, deletion will not be allowed
/dashboard -> To see if youre in a team, or not. Starting page after login
/acceptinvite -> To accept invite from a user. After acception, no changes permitted

Important: Send Authorization header with token obtained for athentication
