define(['react', 'jquery', 'skel', 'skelLayers', 'init', 'boxCalendar'], function(React, $, myskel, skelLayers, init, BoxCalendar) {
        var SideBar = React.createClass({
            render: function () {
                return (
                    <div id="sidebar">

                        <h1 id="logo">
                            <a href="#">STRIPED</a>
                        </h1>

                        <nav id="nav">
                            <ul>
                                <li className="current">
                                    <a href="#">Latest Post</a>
                                </li>
                                <li>
                                    <a href="#">Archives</a>
                                </li>
                                <li>
                                    <a href="#">About Me</a>
                                </li>
                                <li>
                                    <a href="#">Contact Me</a>
                                </li>
                            </ul>
                        </nav>

                        <section className="box search">
                            <form method="post" action="#">
                                <input type="text" className="text" name="search" placeholder="Search" />
                            </form>
                        </section>

                        <section className="box text-style1">
                            <div className="inner">
                                <p>
                                    <strong>Striped:</strong>
                                    A free and fully responsive HTML5 site
                                    template designed by
                                    <a href="http://n33.co/">AJ</a>
                                    for
                                    <a href="http://html5up.net/">HTML5 UP</a>
                                </p>
                            </div>
                        </section>

                        <section className="box recent-posts">
                            <header>
                                <h2>Recent Posts</h2>
                            </header>
                            <ul>
                                <li>
                                    <a href="#">Lorem ipsum dolor</a>
                                </li>
                                <li>
                                    <a href="#">Feugiat nisl aliquam</a>
                                </li>
                                <li>
                                    <a href="#">Sed dolore magna</a>
                                </li>
                                <li>
                                    <a href="#">Malesuada commodo</a>
                                </li>
                                <li>
                                    <a href="#">Ipsum metus nullam</a>
                                </li>
                            </ul>
                        </section>

                        <section className="box recent-comments">
                            <header>
                                <h2>Recent Comments</h2>
                            </header>
                            <ul>
                                <li>case on
                                    <a href="#">Lorem ipsum dolor</a>
                                </li>
                                <li>molly on
                                    <a href="#">Sed dolore magna</a>
                                </li>
                                <li>case on
                                    <a href="#">Sed dolore magna</a>
                                </li>
                            </ul>
                        </section>

                        <BoxCalendar></BoxCalendar>

                        <ul id="copyright">
                            <li>&copy; Untitled.</li>
                            <li>Design:
                                <a href="http://html5up.net">HTML5 UP</a>
                            </li>
                        </ul>

                    </div>

                )
            }
        });

    return SideBar;
});