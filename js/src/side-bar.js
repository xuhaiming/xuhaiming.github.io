define(['react', 'jquery', 'skel', 'skelLayers', 'init', 'boxCalendar'], function(React, $, myskel, skelLayers, init, BoxCalendar) {
        var SideBar = React.createClass({
            render: function () {
                return (
                    <div id="sidebar">

                        <h1 id="logo">
                            <a href="#">MY BLOG</a>
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
                                    <strong>Note: </strong>
                                    You can find the source code of this website through
                                    <a href="https://github.com/xuhaiming/xuhaiming.github.io"> this link</a>
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

                        <BoxCalendar></BoxCalendar>

                        <ul id="copyright">
                            <li>&copy; 2015 Xu Haiming</li>
                        </ul>

                    </div>

                )
            }
        });

    return SideBar;
});