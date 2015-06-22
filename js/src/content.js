define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    return React.createClass({
        getInitialState: function() {
            return {
                posts: []
            };
        },
        componentDidMount: function(){
            $.get( "http://haimingblogservice.azurewebsites.net/api/Posts", function( data ) {
                this.setState({
                    posts: data.value
                });
            }.bind(this));
        },
        getMonth: function(){
            var month = new Array();
                month[0] = "Jan";
                month[1] = "Feb";
                month[2] = "Mar";
                month[3] = "Apr";
                month[4] = "May";
                month[5] = "June";
                month[6] = "July";
                month[7] = "Aug";
                month[8] = "Sep";
                month[9] = "Oct";
                month[10] = "Nov";
                month[11] = "Dec";
            return month;
        },
        render: function () {
            var Posts = this.state.posts.map(function(data){
                var parsedDate = new Date(data.PublishDate);
                var month = this.getMonth();
                return (
                    <article className="box post post-excerpt">
                        <header>
                            <h2><a href="#">{data.Title}</a></h2>
                            <p>{data.SubTitle}</p>
                        </header>
                        <div className="info">
                            <span className="date"><span className="month">{month[parsedDate.getMonth()]}</span> <span className="day">{parsedDate.getDate()}</span><span className="year">, {parsedDate.getFullYear()}</span></span>
                            <ul className="stats">
                                <li><a href="#" className="icon fa-comment">16</a></li>
                                <li><a href="#" className="icon fa-heart">32</a></li>
                            </ul>
                        </div>
                        <span dangerouslySetInnerHTML={{__html: data.Content}} />
                    </article>
                );
            }.bind(this));
            return (
                <div id="content">
                    <div className="inner">
                        {Posts}

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