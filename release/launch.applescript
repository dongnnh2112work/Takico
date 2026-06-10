-- Stay-open app: menu Thoát / Cmd+Q hoạt động, double-click mở lại trình duyệt

on gameRootPath()
	set p to POSIX path of (path to me)
	if p does not end with "/" then set p to p & "/"
	return p & "Contents/Resources/game"
end gameRootPath

on startGame()
	set g to gameRootPath()
	do shell script "xattr -cr " & quoted form of g & " 2>/dev/null; export TAKICO_ROOT=" & quoted form of g & " && bash " & quoted form of (g & "/takico-start.sh")
end startGame

on stopGame()
	set g to gameRootPath()
	do shell script "export TAKICO_ROOT=" & quoted form of g & " && bash " & quoted form of (g & "/stop-launcher.sh")
end stopGame

on run
	startGame()
end run

-- Double-click icon app khi đang chạy → mở lại game trong trình duyệt
on reopen
	startGame()
end reopen

-- Giữ app sống để menu bar + Quit hoạt động
on idle
	return 60
end idle

on quit
	stopGame()
	continue quit
end quit
