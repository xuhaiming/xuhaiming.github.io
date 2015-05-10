define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    return React.createClass({
        render: function () {
            return (
                <div id="content">
                    <div className="inner">

                        <article className="box post post-excerpt">
                            <header>
                                <h2><a href="#">Welcome to Striped</a></h2>
                                <p>A free, fully responsive HTML5 site template by HTML5 UP</p>
                            </header>
                            <div className="info">
                                <span className="date"><span className="month">Jul<span>y</span></span> <span className="day">14</span><span className="year">, 2014</span></span>
                                <ul className="stats">
                                    <li><a href="#" className="icon fa-comment">16</a></li>
                                    <li><a href="#" className="icon fa-heart">32</a></li>
                                    <li><a href="#" className="icon fa-twitter">64</a></li>
                                    <li><a href="#" className="icon fa-facebook">128</a></li>
                                </ul>
                            </div>
                            <a href="#" className="image featured"><img src="images/pic01.jpg" alt="" /></a>
                            <p>
                                <strong>Hello!</strong> You're looking at <strong>Striped</strong>, a fully responsive HTML5 site template designed by <a href="http://n33.co">AJ</a>
                                for <a href="http://html5up.net">HTML5 UP</a> It features a clean, minimalistic design, styling for all basic page elements (including blockquotes, tables and lists), a
                                repositionable sidebar (left or right), and HTML5/CSS3 code designed for quick and easy customization (see code comments for details).
                            </p>
                            <p>
                                Striped is released for free under the <a href="http://html5up.net/license">Creative Commons Attribution license</a> so feel free to use it for personal projects
                                or even commercial ones &ndash; just be sure to credit <a href="http://html5up.net">HTML5 UP</a> for the design. If you like what you see here, be sure to check out
                                <a href="http://html5up.net">HTML5 UP</a> for more cool designs or follow me on <a href="http://twitter.com/n33co">Twitter</a> for new releases and updates.
                            </p>
                        </article>

                        <article className="box post post-excerpt">
                            <header>
                                <h2><a href="#">Lorem ipsum dolor sit amet</a></h2>
                                <p>Feugiat interdum sed commodo ipsum consequat dolor nullam metus</p>
                            </header>
                            <div className="info">
                                <span className="date"><span className="month">Jul<span>y</span></span> <span className="day">8</span><span className="year">, 2014</span></span>
                                <ul className="stats">
                                    <li><a href="#" className="icon fa-comment">16</a></li>
                                    <li><a href="#" className="icon fa-heart">32</a></li>
                                    <li><a href="#" className="icon fa-twitter">64</a></li>
                                    <li><a href="#" className="icon fa-facebook">128</a></li>
                                </ul>
                            </div>
                            <a href="#" className="image featured"><img src="images/pic02.jpg" alt="" /></a>
                            <p>
                                Quisque vel sapien sit amet tellus elementum ultricies. Nunc vel orci turpis. Donec id malesuada metus.
                                Nunc nulla velit, fermentum quis interdum quis, tate etiam commodo lorem ipsum dolor sit amet dolore.
                                Quisque vel sapien sit amet tellus elementum ultricies. Nunc vel orci turpis. Donec id malesuada metus.
                                Nunc nulla velit, fermentum quis interdum quis, convallis eu sapien. Integer sed ipsum ante.
                            </p>
                        </article>

                        <div className="pagination">
                            <a href="#" className="button previous">Previous Page</a>
                            <div className="pages">
                                <a href="#" className="active">1</a>
                                <a href="#">2</a>
                                <a href="#">3</a>
                                <a href="#">4</a>
                                <span>&hellip;</span>
                                <a href="#">20</a>
                            </div>
                            <a href="#" className="button next">Next Page</a>
                        </div>

                    </div>
                </div>
            );
        }

    });


});