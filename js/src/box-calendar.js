define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    var BoxCalendar = React.createClass({
        render: function () {
            return (
                <section className="box calendar">
                    <div className="inner">
                        <table>
                            <caption>July 2014</caption>
                            <thead>
                                <tr>
                                    <th scope="col" title="Monday">M</th>
                                    <th scope="col" title="Tuesday">T</th>
                                    <th scope="col" title="Wednesday">W</th>
                                    <th scope="col" title="Thursday">T</th>
                                    <th scope="col" title="Friday">F</th>
                                    <th scope="col" title="Saturday">S</th>
                                    <th scope="col" title="Sunday">S</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="4" className="pad">
                                        <span>&nbsp;</span>
                                    </td>
                                    <td>
                                        <span>1</span>
                                    </td>
                                    <td>
                                        <span>2</span>
                                    </td>
                                    <td>
                                        <span>3</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <span>4</span>
                                    </td>
                                    <td>
                                        <span>5</span>
                                    </td>
                                    <td>
                                        <a href="#">6</a>
                                    </td>
                                    <td>
                                        <span>7</span>
                                    </td>
                                    <td>
                                        <span>8</span>
                                    </td>
                                    <td>
                                        <span>9</span>
                                    </td>
                                    <td>
                                        <a href="#">10</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <span>11</span>
                                    </td>
                                    <td>
                                        <span>12</span>
                                    </td>
                                    <td>
                                        <span>13</span>
                                    </td>
                                    <td className="today">
                                        <a href="#">14</a>
                                    </td>
                                    <td>
                                        <span>15</span>
                                    </td>
                                    <td>
                                        <span>16</span>
                                    </td>
                                    <td>
                                        <span>17</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <span>18</span>
                                    </td>
                                    <td>
                                        <span>19</span>
                                    </td>
                                    <td>
                                        <span>20</span>
                                    </td>
                                    <td>
                                        <span>21</span>
                                    </td>
                                    <td>
                                        <span>22</span>
                                    </td>
                                    <td>
                                        <a href="#">23</a>
                                    </td>
                                    <td>
                                        <span>24</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <a href="#">25</a>
                                    </td>
                                    <td>
                                        <span>26</span>
                                    </td>
                                    <td>
                                        <span>27</span>
                                    </td>
                                    <td>
                                        <span>28</span>
                                    </td>
                                    <td className="pad" colspan="3">
                                        <span>&nbsp;</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            );
        }

    });

    return BoxCalendar;
});